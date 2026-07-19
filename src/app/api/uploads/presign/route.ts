import { NextRequest, NextResponse } from "next/server";
import { AwsClient } from "aws4fetch";
import { nanoid } from "nanoid";
import { requireOwnedEvent } from "@/lib/auth";
import { photoKey } from "@/lib/media";

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const ALLOWED_ORIGINAL_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

type FileDescriptor = {
  ext: string;
  sizeBytes: number;
};

type PresignedFile = {
  uid: string;
  keys: { original: string; display: string; thumb: string };
  urls: { original: string; display: string; thumb: string };
};

/**
 * Returns three upload URLs per file. With R2 S3 credentials configured the
 * URLs are presigned PUTs straight to R2 (browser -> R2, no Worker in the
 * data path). Without credentials (local dev) it falls back to
 * /api/uploads/direct, which streams through the Worker into the R2 binding.
 */
export async function POST(req: NextRequest) {
  const { eventId, files } = (await req.json()) as {
    eventId: string;
    files: FileDescriptor[];
  };
  const { company, event } = await requireOwnedEvent(eventId);

  if (!Array.isArray(files) || files.length === 0 || files.length > 50) {
    return new NextResponse("Send 1-50 files per presign request", {
      status: 400,
    });
  }

  const creds = {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME || "pixolateds-media",
  };
  const canPresign =
    !!creds.accountId && !!creds.accessKeyId && !!creds.secretAccessKey;

  const client = canPresign
    ? new AwsClient({
        accessKeyId: creds.accessKeyId!,
        secretAccessKey: creds.secretAccessKey!,
      })
    : null;

  const results: PresignedFile[] = [];
  for (const file of files) {
    const ext = file.ext.toLowerCase().replace("jpeg", "jpg");
    if (!ALLOWED_ORIGINAL_EXT.has(ext)) {
      return new NextResponse(`Unsupported file type .${ext}`, { status: 400 });
    }
    if (file.sizeBytes > MAX_FILE_BYTES) {
      return new NextResponse("Files must be under 30MB", { status: 400 });
    }

    const uid = nanoid();
    const keys = {
      original: photoKey(company.id, event.id, uid, "original", ext),
      display: photoKey(company.id, event.id, uid, "display", "webp"),
      thumb: photoKey(company.id, event.id, uid, "thumb", "webp"),
    };

    const urls = { original: "", display: "", thumb: "" };
    for (const variant of ["original", "display", "thumb"] as const) {
      const key = keys[variant];
      if (client) {
        const r2Endpoint = `https://${creds.bucket}.${creds.accountId}.r2.cloudflarestorage.com/${key}?X-Amz-Expires=3600`;
        const signed = await client.sign(
          new Request(r2Endpoint, { method: "PUT" }),
          { aws: { signQuery: true, service: "s3", region: "auto" } },
        );
        urls[variant] = signed.url;
      } else {
        urls[variant] = `/api/uploads/direct?key=${encodeURIComponent(key)}`;
      }
    }
    results.push({ uid, keys, urls });
  }

  return NextResponse.json({ files: results });
}
