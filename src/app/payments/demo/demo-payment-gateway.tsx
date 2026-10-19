type DemoPaymentGatewayProps = {
  authority: string;
  callbackUrl: string | null;
  amountRial: string | null;
  description: string | null;
  orderId: string | null;
  enabled: boolean;
};

function formatToman(amountRial: string | null): string {
  if (!amountRial || !/^\d+$/.test(amountRial)) return 'مبلغ در بازگشت مجدد نمایش داده نمی‌شود';
  return `${(BigInt(amountRial) / BigInt(10)).toLocaleString('fa-IR')} تومان`;
}

export function DemoPaymentGateway(props: DemoPaymentGatewayProps) {
  return (
    <section className="container demo-payment-shell">
      <article className="card demo-payment-card" aria-labelledby="demo-payment-title">
        <div className="demo-payment-badge">محیط آزمایشی</div>
        <div className="demo-payment-mark" aria-hidden="true">✓</div>
        <div>
          <div className="eyebrow">درگاه نمایشی وازانو</div>
          <h1 id="demo-payment-title">شبیه‌سازی پرداخت</h1>
          <p className="muted">در این صفحه هیچ مبلغ واقعی برداشت نمی‌شود. فقط نتیجه پرداخت برای آزمون گردش کار وازانو ثبت خواهد شد.</p>
        </div>

        <dl className="demo-payment-details">
          <div><dt>مبلغ</dt><dd>{formatToman(props.amountRial)}</dd></div>
          <div><dt>شرح</dt><dd>{props.description || 'پرداخت آزمایشی وازانو'}</dd></div>
          <div><dt>شماره سفارش</dt><dd dir="ltr">{props.orderId || '—'}</dd></div>
          <div><dt>شناسه آزمایشی</dt><dd dir="ltr">{props.authority.slice(0, 14)}…</dd></div>
        </dl>

        {!props.enabled && <p className="message message-error">این درگاه فقط در محیط توسعه و برای نشانی بازگشت معتبر وازانو قابل استفاده است.</p>}

        <div className="actions demo-payment-actions">
          <form action={props.callbackUrl ?? undefined} method="get">
            <input name="Authority" type="hidden" value={props.authority} />
            <input name="Status" type="hidden" value="OK" />
            <button className="button button-primary" type="submit" disabled={!props.enabled}>پرداخت موفق آزمایشی</button>
          </form>
          <form action={props.callbackUrl ?? undefined} method="get">
            <input name="Authority" type="hidden" value={props.authority} />
            <input name="Status" type="hidden" value="NOK" />
            <button className="button button-secondary" type="submit" disabled={!props.enabled}>انصراف از پرداخت</button>
          </form>
        </div>

        <small className="muted">این صفحه جایگزین موقت درگاه واقعی است و در محیط عملیاتی غیرفعال می‌ماند.</small>
      </article>
    </section>
  );
}
