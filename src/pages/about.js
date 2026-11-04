import { buildInfo } from '../services/versionService.js';
import { checkForUpdate } from '../services/updateService.js';
/**
 * pages/about.js
 */

import { el, clearNode } from "../utils/dom.js";
import { t } from "../services/i18nService.js";

export function renderAbout(container) {
  clearNode(container);

  container.appendChild(el("div", { class: "page-head" }, [
    el("h1", {}, t("about.title")),
    el("p", { class: "sub" }, t("about.subtitle")),
  ]));

  container.appendChild(el("div", { class: "panel glass about-panel" }, [
    el("p", {}, t("about.description1")),
    el("p", {}, t("about.description2")),
  ]));

  container.appendChild(el("div", { class: "panel glass" }, [
    el("div", { class: "panel-title" }, t("about.architectureTitle")),
    el("p", { class: "panel-hint" }, t("about.architectureBody")),
  ]));

  const rows = el('dl', { class: 'build-identification', id: 'runningBuild' });
  const row = (key, value) => rows.append(el('dt', {}, t(key)), el('dd', {}, value));
  row('build.running', buildInfo.version);
  row('build.identifier', String(buildInfo.build));
  const remote = el('p', { id: 'availableBuild', role: 'status', class: 'panel-hint' }, t('build.notChecked'));
  const check = el('button', { class: 'btn ghost' }, t('build.check'));
  check.addEventListener('click', async () => {
    check.disabled = true;
    try {
      const result = await checkForUpdate({ force: true });
      remote.textContent = result.latest ? t('build.server') + ': ' + result.latest.version + ' / ' + (result.latest.build || '?') : t('build.unreachable');
    } finally { check.disabled = false; }
  });
  container.append(el('div', { class: 'panel glass' }, [rows, remote, check]));

  const sourceLink = el("a", {
    class: "link",
    href: "https://github.com/wjc1022/PrivateKara",
    target: "_blank",
    rel: "noopener",
  }, "github.com/wjc1022/PrivateKara");

  container.appendChild(el("div", { class: "panel glass" }, [
    el("div", { class: "panel-title" }, t("about.source")),
    sourceLink,
  ]));

  const authorLink = el("a", {
    class: "link",
    href: "https://github.com/Behnooddev",
    target: "_blank",
    rel: "noopener",
  }, "github.com/Behnooddev");

  container.appendChild(el("div", { class: "panel glass" }, [
    el("div", { class: "panel-title" }, t("about.developedAndMaintainedBy")),
    el("p", { class: "panel-hint", style: "margin-bottom:6px;" }, "Junchao Wen"),
    el("p", { class: "panel-hint" }, t("about.upstreamAttribution")),
    authorLink,
  ]));

  container.appendChild(el("div", { class: "panel glass" }, [
    el("div", { class: "panel-title" }, t("about.license")),
    el("p", { class: "panel-hint" }, "MIT — see LICENSE"),
  ]));
}
