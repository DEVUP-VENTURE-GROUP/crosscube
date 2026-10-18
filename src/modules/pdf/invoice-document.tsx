import type { InvoiceDocumentModel } from "./invoice-document-model";
import { PAPER_DIMENSIONS } from "./invoice-document.css";

export function InvoiceDocument({ model }: { model: InvoiceDocumentModel }) {
  const b = model.business;
  return (
    <div className="inv-doc" data-invoice-document="" style={{ minHeight: PAPER_DIMENSIONS[model.paperSize].contentHeight }}>
      {model.watermark && (
        <div className="inv-watermark" aria-hidden="true">
          {model.watermark}
        </div>
      )}
      {model.demoNotice && <div className="inv-demo">DEMONSTRATION RECORD — sample values for testing only; prices are not verified supplier pricing.</div>}

      <header className="inv-top">
        <div>{b.logoDataUrl && <img className="inv-logo" src={b.logoDataUrl} alt="" />}</div>
        <div className="inv-biz">
          <div className="inv-biz-name">{b.businessName}</div>
          {model.businessAddress.map((line) => (
            <div key={line}>{line}</div>
          ))}
          {model.businessContact && <div>{model.businessContact}</div>}
        </div>
        <div className="inv-numbox">
          <div className="inv-numlabel">{b.invoiceTitle.toUpperCase()}</div>
          <div className="inv-num">{model.invoiceLabel}</div>
          {model.estimateNumber && <div className="inv-orgest">Org. Est. # {model.estimateNumber}</div>}
        </div>
      </header>

      <div className="inv-titlerow">
        <span className="inv-title">{b.invoiceTitle.toUpperCase()}</span>
        <span className="inv-printed">Printed Date: {model.printedDate}</span>
      </div>

      <section className="inv-cv">
        <div className="inv-cv-left">
          <div className="inv-cv-head wrap">{model.customerHeading}</div>
          {model.customerAddress.map((line, index) => (
            <div key={index} className="wrap">
              {line}
            </div>
          ))}
          {model.customerPhone && <div>{model.customerPhone}</div>}
          {model.customerEmail && <div className="wrap">{model.customerEmail}</div>}
        </div>
        <div className="inv-cv-right">
          <div className="wrap">{model.vehicleDescription}</div>
          <div className="inv-spread">
            <span>{model.licensePlate && `Lic # : ${model.licensePlate}`}</span>
            <span>{model.odometer && `Odometer In : ${model.odometer}`}</span>
          </div>
          {model.vinEnd && (
            <div>
              VIN # : {model.vinStart}
              <span className="b">{model.vinEnd}</span>
            </div>
          )}
        </div>
      </section>

      <section className="inv-body">
        <div className="inv-col">
          <table className="inv-table">
            <colgroup>
              <col />
              <col style={{ width: "36pt" }} />
              <col style={{ width: "44pt" }} />
              <col style={{ width: "40pt" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Part Description</th>
                <th className="num">Qty</th>
                <th className="num">Sale</th>
                <th className="num">Ext</th>
              </tr>
            </thead>
            <tbody>
              {model.partsRows.map((row) => (
                <tr key={row.key}>
                  <td className={`wrap ${row.feeOnly ? "inv-indent" : ""}`}>
                    {row.description}
                    {row.sku && <div>{row.sku}</div>}
                    {row.notes && <div className="pre inv-labor-notes">{row.notes}</div>}
                  </td>
                  <td className="num">{row.quantity}</td>
                  <td className="num">{row.unitPrice}</td>
                  <td className="num">{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="inv-col">
          <table className="inv-table">
            <colgroup>
              <col />
              <col style={{ width: "44pt" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Labor Description</th>
                <th className="num">Ext</th>
              </tr>
            </thead>
            <tbody>
              {model.laborRows.map((row) => (
                <tr key={row.key}>
                  <td className="wrap">
                    {row.description}
                    {row.detail && <div className="inv-labor-notes">{row.detail}</div>}
                    {row.notes && <div className="pre inv-labor-notes">{row.notes}</div>}
                  </td>
                  <td className="num">{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="inv-bottom">
        <div className="inv-bottom-left">
          {model.estimateSummary && (
            <div className="inv-estimate">
              <span>
                Org. Estimate<span>{model.estimateSummary.original}</span>
              </span>
              <span>
                Revisions<span>{model.estimateSummary.revisions}</span>
              </span>
              <span>
                Current Estimate<span>{model.estimateSummary.current}</span>
              </span>
            </div>
          )}
          {model.notes && <div className="inv-notes pre wrap">{model.notes}</div>}
          <div className="inv-payments">{model.paymentSummary ? `[ ${model.paymentSummary} ]` : " "}</div>
        </div>
        <div className="inv-totals" data-totals="">
          <table>
            <tbody>
            {model.documentTotals.map((row) => (
              <tr key={row.label} className={[row.gapBefore ? "gap" : "", row.ruleAbove ? "rule" : ""].join(" ").trim() || undefined}>
                <td>{row.label}</td>
                <td className="num">{row.amount}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="inv-received">
        <span>{model.vehicleReceived && `Vehicle Received: ${model.vehicleReceived}`}</span>
        <span>{model.customerNumber && `Customer Number : ${model.customerNumber}`}</span>
      </div>
      {(b.authorizationText || b.warrantyText || b.showSignatureLines) && (
        <section className="inv-auth">
          {b.authorizationText && <p className="pre">{b.authorizationText}</p>}
          {b.warrantyText && <p className="pre">{b.warrantyText}</p>}
          {b.showSignatureLines && (
            <div className="inv-sign">
              <span>Signature</span>
              <span className="line" />
              <span>Date</span>
              <span className="line" />
            </div>
          )}
        </section>
      )}

      {(b.website || b.email) && (
        <footer className="inv-footer">
          <span>{b.website && <>Visit us on the web:&nbsp;&nbsp;&nbsp;{b.website}</>}</span>
          <span className="email">
            {b.email && (
              <>
                Email Address: <b>{b.email}</b>
              </>
            )}
          </span>
        </footer>
      )}
      {b.footerNote && <div className="inv-footer-note pre">{b.footerNote}</div>}
    </div>
  );
}
