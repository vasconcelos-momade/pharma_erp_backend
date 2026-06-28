import Handlebars from "handlebars";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { type ReportDefinition } from "../types/report.types";
import { buildInstitutionalReportView } from "./report-presentation.builder";

const TEMPLATES_ROOT = join(import.meta.dir, "../../templates");

let layoutTemplate: Handlebars.TemplateDelegate | null = null;
let institutionalCss: string | null = null;
const partialTemplates = new Map<string, Handlebars.TemplateDelegate>();

function readTemplate(relativePath: string): string {
  return readFileSync(join(TEMPLATES_ROOT, relativePath), "utf-8");
}

function registerPartials(): void {
  if (partialTemplates.size > 0) {
    return;
  }

  const partialFiles = readdirSync(join(TEMPLATES_ROOT, "partials")).filter((file) =>
    file.endsWith(".hbs"),
  );

  for (const file of partialFiles) {
    const name = file.replace(/\.hbs$/, "");
    const template = Handlebars.compile(readTemplate(`partials/${file}`));
    partialTemplates.set(name, template);
    Handlebars.registerPartial(name, template);
  }
}

function ensureTemplates(): void {
  registerPartials();
  if (!layoutTemplate) {
    layoutTemplate = Handlebars.compile(readTemplate("base/layout.hbs"));
    institutionalCss = readTemplate("styles/institutional.css");
  }
}

export function renderInstitutionalReportHtml(definition: ReportDefinition): string {
  ensureTemplates();
  if (!layoutTemplate) {
    throw new Error("Template institucional indisponivel");
  }

  const view = buildInstitutionalReportView(definition);
  return layoutTemplate({
    title: view.title,
    css: institutionalCss ?? "",
    pageOrientation: view.pageOrientation,
    pageSize: view.pageSize,
    watermarkText: view.watermarkText,
    footer: view.footer,
    sections: view.sections,
    partialMap: Object.fromEntries(partialTemplates.keys().map((key) => [key, key])),
  });
}
