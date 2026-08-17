export function SiteFooter() {
	return (
		<footer className="pb-10 text-center text-xs text-[var(--mist)]">
			<div>
				Powered by{" "}
				<a
					href="https://pixolateds.com"
					target="_blank"
					rel="noopener"
					className="text-[var(--mist)] transition-colors hover:text-[var(--ink-strong)] hover:underline"
				>
					pixolateds
				</a>
			</div>
			<div>Made with ♥ in Singapore</div>
		</footer>
	);
}
