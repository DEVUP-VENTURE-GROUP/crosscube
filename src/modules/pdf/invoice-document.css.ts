export const PAPER_DIMENSIONS = {
  LETTER: { width: "8.5in", height: "11in", contentHeight: "9.98in", pdfFormat: "Letter" },
  A4: { width: "210mm", height: "297mm", contentHeight: "271mm", pdfFormat: "A4" },
} as const;

export const PAGE_MARGIN = { top: "0.4in", right: "0.35in", bottom: "0.55in", left: "0.35in" } as const;

export const INVOICE_DOCUMENT_CSS = `
.inv-doc{position:relative;display:flex;flex-direction:column;font-family:Arimo,Arial,Helvetica,sans-serif;font-size:7.5pt;line-height:1.28;color:#000;background:#fff;text-align:left}
.inv-doc *{box-sizing:border-box;margin:0;padding:0}
.inv-doc table{border-collapse:collapse;width:100%}
.inv-doc thead{display:table-header-group}
.inv-doc tr{break-inside:avoid}
.inv-doc .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.inv-doc .wrap{overflow-wrap:anywhere}
.inv-doc .pre{white-space:pre-wrap}
.inv-doc .b{font-weight:700}
.inv-watermark{position:fixed;top:38%;left:0;right:0;text-align:center;font-size:96pt;font-weight:700;letter-spacing:6pt;color:rgba(0,0,0,.07);transform:rotate(-28deg);pointer-events:none;z-index:0}
.inv-demo{border:.75pt dashed #000;padding:2pt 4pt;margin-bottom:4pt;font-size:7pt;text-align:center}
.inv-top{display:grid;grid-template-columns:2.55in minmax(0,1fr) 1.45in;align-items:start;gap:8pt}
.inv-logo{max-height:46pt;max-width:2.4in;object-fit:contain}
.inv-biz{font-size:8pt;line-height:1.3}
.inv-biz-name{font-weight:700;text-transform:uppercase}
.inv-numbox{text-align:center;justify-self:end;width:1.45in}
.inv-numlabel{font-weight:700;font-size:8pt}
.inv-num{border:1pt solid #000;border-radius:3pt;font-weight:700;font-size:9pt;padding:1.5pt 4pt;margin-top:1pt}
.inv-orgest{font-size:6.5pt;text-align:right;margin-top:2pt}
.inv-titlerow{display:grid;grid-template-columns:1fr 1fr;align-items:end;margin-top:12pt;padding-bottom:1.5pt;border-bottom:1.25pt solid #000}
.inv-title{font-size:12pt;font-weight:700;letter-spacing:.2pt}
.inv-printed{font-size:7pt;padding-left:.2in}
.inv-cv{display:grid;grid-template-columns:1fr 1fr;gap:10pt;padding-top:2pt;break-inside:avoid}
.inv-cv-left div,.inv-cv-right div{min-height:10.5pt}
.inv-cv-head{font-weight:700}
.inv-spread{display:flex;justify-content:space-between;gap:8pt}
.inv-body{flex:1 0 auto;display:grid;grid-template-columns:1fr 1fr;margin-top:3pt;border-top:.75pt solid #000;min-height:1in}
.inv-col{min-width:0}
.inv-col+.inv-col{border-left:.75pt solid #000}
.inv-table{table-layout:fixed}
.inv-table th{font-weight:700;font-size:7.5pt;text-align:left;padding:1pt 3pt 1.5pt;border-bottom:.75pt solid #000}
.inv-table th.num{text-align:right}
.inv-table td{padding:1.5pt 3pt;vertical-align:top}
.inv-indent{padding-left:12pt!important}
.inv-labor-notes{padding-left:6pt}
.inv-bottom{display:grid;grid-template-columns:minmax(0,1fr) 1.75in;gap:8pt;align-items:stretch;break-inside:avoid}
.inv-bottom-left{display:flex;flex-direction:column;border-top:.75pt solid #000;margin-top:-.75pt}
.inv-estimate{display:flex;gap:28pt;padding:1.5pt 3pt;font-size:7pt;border-bottom:.5pt solid #000}
.inv-estimate span span{margin-left:10pt}
.inv-notes{padding:3pt 3pt 0;font-size:7pt}
.inv-payments{margin-top:auto;padding:0 3pt 1pt;border-bottom:.75pt solid #000;font-size:6.5pt;font-weight:700}
.inv-totals{border:1pt solid #000;border-radius:4pt;padding:3pt 5pt;margin-top:3pt}
.inv-totals table{width:100%}
.inv-totals td{padding:.6pt 0;font-weight:700}
.inv-totals td.num{padding-left:6pt}
.inv-totals tr.gap td{padding-top:8pt}
.inv-totals tr.rule td.num{border-top:.75pt solid #000}
.inv-received{display:flex;justify-content:space-between;margin-top:10pt;font-size:6.5pt;break-inside:avoid}
.inv-auth{border:1pt solid #000;border-radius:3pt;padding:3pt 5pt 4pt;margin-top:1pt;font-size:6.5pt;break-inside:avoid}
.inv-auth p+p{margin-top:2pt}
.inv-sign{display:grid;grid-template-columns:auto 3.9in auto minmax(0,1fr);align-items:end;gap:2pt;margin-top:8pt;font-size:7.5pt}
.inv-sign .line{border-bottom:.75pt solid #000;height:9pt}
.inv-footer{display:grid;grid-template-columns:1fr 1fr;margin-top:7pt;font-size:6.5pt;break-inside:avoid}
.inv-footer .email{padding-left:.6in}
.inv-footer .email b{font-style:italic}
.inv-footer-note{margin-top:3pt;font-size:6.5pt;text-align:center}
`;
