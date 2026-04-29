import { ReportIssue } from "@/components/report-issue";

export function SiteFooter() {
  return (
    <footer className="border-grid border-t py-6 md:py-0 md:mt-4">
      <div className="container-wrapper px-responsive">
        <div className="py-4">
          <div className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left rtl:md:text-right">
            Built by{" "}
            <a
              href="https://databayt.org"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              databayt
            </a>
            . The source code is available on{" "}
            <a
              href="https://github.com/databayt/kun"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              GitHub
            </a>
            . <ReportIssue />
          </div>
        </div>
      </div>
    </footer>
  );
}
