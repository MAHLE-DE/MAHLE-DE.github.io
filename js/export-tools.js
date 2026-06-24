/* ==========================
   PNG EXPORT
========================== */

document.addEventListener("click", event => {
  const button = event.target.closest("[data-export-selector]");
  if (!button) return;

  event.preventDefault();
  exportarElementoComoPng(
    button.dataset.exportSelector,
    button.dataset.exportName || "mahle-export",
    button
  );
});

function exportarElementoComoPng(selector, fileName, button) {
  const target = document.querySelector(selector);
  if (!target) return;

  if (typeof html2canvas !== "function") {
    alert("PNG export is still loading. Please try again in a moment.");
    return;
  }

  const originalText = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  const exportSize = calcularTamanhoExportacao(target);

  html2canvas(target, {
    backgroundColor: "#ffffff",
    scale: Math.min(2, window.devicePixelRatio || 1.5),
    useCORS: true,
    width: exportSize.width,
    height: exportSize.height,
    windowWidth: Math.max(document.documentElement.clientWidth, exportSize.width),
    windowHeight: Math.max(document.documentElement.clientHeight, exportSize.height),
    onclone: clonedDoc => {
      const clonedTarget = clonedDoc.querySelector(selector);
      if (!clonedTarget) return;

      clonedDoc.body.classList.add("mahle-exporting");
      clonedTarget.style.overflow = "visible";
      clonedTarget.style.maxWidth = "none";
      clonedTarget.style.width = `${exportSize.width}px`;
      clonedTarget.style.height = `${exportSize.height}px`;
      clonedTarget.style.opacity = "1";
      clonedTarget.style.transform = "none";
      clonedTarget.style.contentVisibility = "visible";
      clonedTarget.querySelectorAll("*").forEach(item => {
        item.style.animation = "none";
        item.style.transition = "none";
        item.style.contentVisibility = "visible";
      });
      clonedTarget.querySelectorAll(".audit-schedule-calendar-scroll").forEach(item => {
        item.style.overflow = "visible";
        item.style.maxWidth = "none";
        item.style.width = `${exportSize.scrollerWidth || exportSize.width}px`;
        item.style.cursor = "default";
      });
      clonedTarget.querySelectorAll(".audit-schedule-month-lane").forEach(item => {
        item.style.opacity = "1";
        item.style.transform = "none";
      });
      prepararPendingClassifierParaExportacao(clonedTarget, fileName);
      prepararLosangosAuditParaExportacao(clonedDoc, clonedTarget);
      clonedTarget.querySelectorAll(".export-png-btn").forEach(item => {
        item.style.display = "none";
      });
    }
  })
    .then(canvas => {
      const link = document.createElement("a");
      link.download = `${normalizarNomeArquivoPng(fileName)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    })
    .catch(error => {
      console.error("PNG export failed:", error);
      alert("PNG export failed. Please try again.");
    })
    .finally(() => {
      button.disabled = false;
      button.innerHTML = originalText;
    });
}

function calcularTamanhoExportacao(target) {
  if (target.matches("#pendingClassifierKpi")) {
    return {
      width: 1500,
      height: 780
    };
  }

  if (target.matches(".audit-schedule-calendar-board")) {
    return calcularTamanhoCalendario(target);
  }

  if (target.matches(".dashboard-card")) {
    return {
      width: Math.ceil(Math.max(target.scrollWidth, target.offsetWidth)),
      height: Math.ceil(Math.max(target.scrollHeight, target.offsetHeight) + 150)
    };
  }

  const width = Math.max(target.scrollWidth, target.offsetWidth);
  const height = Math.max(target.scrollHeight, target.offsetHeight);

  return {
    width: Math.ceil(width),
    height: Math.ceil(height)
  };
}

function prepararPendingClassifierParaExportacao(clonedTarget, fileName) {
  if (!clonedTarget.matches("#pendingClassifierKpi") || fileName !== "pending-classifier-kpis") {
    return;
  }

  clonedTarget.classList.add("pending-kpi-export-layout");
  clonedTarget.style.display = "grid";
  clonedTarget.style.gridTemplateColumns = "minmax(0, 1fr) minmax(0, 1fr)";
  clonedTarget.style.gap = "24px";
  clonedTarget.style.padding = "24px";
  clonedTarget.style.background = "#ffffff";

  Array.from(clonedTarget.children).forEach(child => {
    child.style.display = "none";
  });

  const grids = clonedTarget.querySelectorAll(".pending-kpi-grid, .pending-kpi-secondary-grid");
  if (!grids.length) return;

  grids.forEach(grid => {
    grid.style.display = "contents";
  });

  const cards = Array.from(clonedTarget.querySelectorAll(".pending-kpi-panel"));
  cards.forEach(card => {
    const title = card.querySelector("h3")?.textContent?.trim() || "";
    const keep = title === "Main pending types" || title === "Development Engineer workload";
    card.style.display = keep ? "block" : "none";
    if (!keep) return;

    card.style.minHeight = "700px";
    card.style.padding = "30px";
    card.style.borderRadius = "28px";
    card.style.boxShadow = "none";
    card.style.border = "1px solid #dce5f5";

    const chart = card.querySelector(".pending-kpi-chart-wrap");
    if (chart) {
      chart.style.height = "560px";
    }

    const deScroll = card.querySelector(".pending-de-chart-scroll");
    const deChart = card.querySelector(".pending-de-chart");
    if (deScroll) {
      deScroll.style.overflow = "visible";
      deScroll.style.paddingTop = "18px";
    }
    if (deChart) {
      deChart.style.height = "560px";
      deChart.style.minWidth = "100%";
      deChart.style.gap = "18px";
    }
  });
}

function prepararLosangosAuditParaExportacao(clonedDoc, clonedTarget) {
  clonedTarget.querySelectorAll(".audit-doc-status-diamond").forEach(item => {
    const styles = clonedDoc.defaultView.getComputedStyle(item);
    const fill = styles.backgroundColor || "#22a35a";
    const stroke = styles.borderTopColor || "rgba(15, 23, 42, 0.55)";

    item.style.clipPath = "none";
    item.style.background = "transparent";
    item.style.border = "0";
    item.style.boxShadow = "none";
    item.style.overflow = "visible";
    item.style.display = "inline-grid";
    item.style.placeItems = "center";
    item.style.transform = item.closest(".audit-doc-bar")
      ? "translateY(-50%)"
      : "none";
    item.innerHTML = `
      <svg viewBox="0 0 118 100" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="59,3 115,50 59,97 3,50" fill="${fill}" stroke="${stroke}" stroke-width="5"></polygon>
      </svg>
    `;
  });
}

function calcularTamanhoCalendario(target) {
  const scroller = target.querySelector(".audit-schedule-calendar-scroll");
  const header = target.querySelector(".audit-schedule-calendar-head");
  if (!scroller) {
    return {
      width: Math.ceil(Math.max(target.scrollWidth, target.offsetWidth)),
      height: Math.ceil(Math.max(target.scrollHeight, target.offsetHeight))
    };
  }

  const lanes = Array.from(scroller.querySelectorAll(".audit-schedule-month-lane"));
  const scrollerStyles = window.getComputedStyle(scroller);
  const gap = parseFloat(scrollerStyles.columnGap || scrollerStyles.gap) || 0;
  const paddingX =
    (parseFloat(scrollerStyles.paddingLeft) || 0) +
    (parseFloat(scrollerStyles.paddingRight) || 0);
  const laneWidth = lanes.reduce((sum, lane) => sum + lane.getBoundingClientRect().width, 0);
  const compactScrollerWidth = paddingX + laneWidth + Math.max(0, lanes.length - 1) * gap;
  const headerHeight = header ? header.getBoundingClientRect().height : 0;
  const scrollerHeight = Math.max(scroller.scrollHeight, scroller.getBoundingClientRect().height);

  return {
    width: Math.ceil(Math.max(target.getBoundingClientRect().width, compactScrollerWidth)),
    height: Math.ceil(headerHeight + scrollerHeight),
    scrollerWidth: Math.ceil(compactScrollerWidth)
  };
}

function normalizarNomeArquivoPng(value) {
  return String(value || "mahle-export")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
