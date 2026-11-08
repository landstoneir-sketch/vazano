'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import styles from './home.module.css';

const slides = [
  {
    number: '۰۱',
    status: 'در حال دریافت پیشنهاد',
    title: 'تراورتن عباس‌آباد برای نمای مجتمع مسکونی',
    description: '۴۰ طولی · ضخامت ۲ سانتی‌متر · سابیده · کرم روشن کم‌موج',
    facts: [['مقدار', '۱٬۸۵۰ مترمربع'], ['مقصد', 'تهران'], ['تحویل', 'طی ۲۵ روز']],
    currentStage: 1,
    response: '۴ پیشنهاد ثبت‌شده',
    suppliers: 'از ۱۲ تأمین‌کننده مرتبط',
    imagePosition: 'center',
  },
  {
    number: '۰۲',
    status: 'نیازمند پاسخ فروشنده',
    title: 'گرانیت نهبندان فلیم برای محوطه مجتمع تجاری',
    description: '۴۰×۴۰ · ضخامت ۳ سانتی‌متر · فلیم · طوسی روشن',
    facts: [['مقدار', '۳٬۲۰۰ مترمربع'], ['مقصد', 'مشهد'], ['تحویل', '۳ محموله']],
    currentStage: 1,
    response: '۲ پاسخ و ۱ پیش‌نویس',
    suppliers: 'از ۸ کارخانه واجد شرایط',
    imagePosition: '22% center',
  },
  {
    number: '۰۳',
    status: 'در حال مقایسه',
    title: 'اسلب چینی ازنا برای لابی هتل',
    description: 'اسلب · ضخامت ۲ سانتی‌متر · صیقلی · زمینه سفید با رگه کنترل‌شده',
    facts: [['مقدار', '۴۲۰ مترمربع'], ['مقصد', 'جزیره کیش'], ['الزام', 'تأیید چیدمان']],
    currentStage: 2,
    response: '۳ پیشنهاد قابل مقایسه',
    suppliers: 'از ۶ تأمین‌کننده تخصصی اسلب',
    imagePosition: '78% center',
  },
] as const;

const stages = ['ثبت نیاز', 'دریافت پاسخ', 'مقایسه', 'انتخاب'] as const;

export function HomeRfqSlider() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const pointerStart = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setCurrent((value) => (value + 1) % slides.length), 5800);
    return () => window.clearInterval(timer);
  }, [paused]);

  function move(offset: number) {
    setCurrent((value) => (value + offset + slides.length) % slides.length);
  }

  const slide = slides[current];

  return (
    <div
      className={`${styles.glass} ${styles.rfqShowcase}`}
      ref={root}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className={styles.rfqShowcaseHead}>
        <div>
          <h2 id="rfq-showcase-title">نمونه استعلام‌ها را ورق بزنید</h2>
          <p>نمونه‌های نمایشی برای شناخت ساختار درخواست؛ قیمت روز یا پیشنهاد تجاری نیستند.</p>
        </div>
        <div className={styles.rfqControls}>
          <button className={styles.rfqNav} type="button" onClick={() => move(-1)} aria-label="نمونه قبلی">‹</button>
          <span className={styles.slideCount}><b>{(current + 1).toLocaleString('fa-IR')}</b> از ۳</span>
          <button className={styles.rfqNav} type="button" onClick={() => move(1)} aria-label="نمونه بعدی">›</button>
        </div>
      </div>

      <div
        className={styles.rfqTrack}
        aria-live="polite"
        onPointerDown={(event) => { pointerStart.current = event.clientX; }}
        onPointerUp={(event) => {
          if (pointerStart.current === null) return;
          const delta = event.clientX - pointerStart.current;
          pointerStart.current = null;
          if (Math.abs(delta) > 45) move(delta > 0 ? -1 : 1);
        }}
      >
        <article className={styles.rfqSlide} key={slide.number}>
          <div className={styles.rfqCopy}>
            <span className={styles.rfqKicker}>{slide.status}</span>
            <h3>{slide.title}</h3>
            <p>{slide.description}</p>
            <dl className={styles.rfqMeta}>
              {slide.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
            <ol className={styles.rfqStage} aria-label="مراحل استعلام">
              {stages.map((stage, index) => (
                <li className={index < slide.currentStage ? styles.done : index === slide.currentStage ? styles.current : undefined} key={stage}>{stage}</li>
              ))}
            </ol>
          </div>
          <div className={styles.rfqVisual}>
            <Image
              src="/home/rfq-stone-showcase.png"
              alt="نمونه‌ای از سنگ‌های ساختمانی در یک درخواست خرید"
              fill
              sizes="(max-width: 620px) 100vw, 45vw"
              style={{ objectFit: 'cover', objectPosition: slide.imagePosition }}
            />
            <span className={styles.rfqNumber}>{slide.number}</span>
            <div className={styles.rfqVisualNote}><strong>{slide.response}</strong>{slide.suppliers}</div>
            <div className={styles.rfqProgress} aria-hidden="true"><span /></div>
          </div>
        </article>
      </div>

      <div className={styles.rfqDots} aria-label="انتخاب نمونه استعلام">
        {slides.map((item, index) => (
          <button
            className={`${styles.rfqDot} ${index === current ? styles.activeDot : ''}`}
            type="button"
            aria-label={`نمونه ${item.number}`}
            aria-current={index === current ? 'true' : undefined}
            onClick={() => setCurrent(index)}
            key={item.number}
          />
        ))}
      </div>
    </div>
  );
}
