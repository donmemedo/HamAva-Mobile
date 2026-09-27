"use client";
import { createContext, useCallback, useContext, useState } from "react";

export type Lang = "fa" | "en";
export type L = string | Record<Lang, string>;

// Persian copy follows the UX-writing vocab: پیش‌خوان، پیامک، شماره موبایل، نادرست، بازگشت، …
const dict = {
  fa: {
    brand: "هم‌آوا", home: "خانه", community: "جامعه", dashboard: "پیش‌خوان", join: "سیم‌کارت رایگان", plans: "بسته‌ها",
    theme: "تغییر پوسته", lang: "English",
    eyebrow: "اپراتور مجازی جامعه‌محور", h1a: "موبایل،", h1b: "به روش مردم.",
    heroSub: "بدون قرارداد، بدون صف پشت خط. به هم کمک کنید، امتیاز بگیرید و قبض‌تان را کوچک و کوچک‌تر کنید.",
    cta: "سیم‌کارت رایگان بگیرید", cta2: "مشاهده بسته‌ها",
    chipPts: "امتیاز برای هر پاسخ", chipMin: "دقیقه تا اولین پاسخ", chipZero: "قرارداد بلندمدت",
    sMembers: "عضو فعال", sAnswered: "٪ سوال‌ها پاسخ گرفته‌اند", sAvg: "دقیقه میانگین زمان پاسخ", sDonated: "تومان کمک به خیریه",
    howT: "سه ایده ساده.", howT2: "یک اپراتور متفاوت.",
    simT: "سیم‌کارت رایگان", simD: "فرم کوتاه را پر کنید؛ سیم‌کارت یا eSIM رایگان به دستتان می‌رسد. هر ماه بسته‌تان را تغییر دهید.",
    comT: "پشتیبانی با جامعه", comD: "به‌جای کال‌سنتر، اعضا به هم کمک می‌کنند و برای هر پاسخ مفید امتیاز می‌گیرند.",
    rewT: "باشگاه پاداش", rewD: "امتیازها را به شارژ، پول نقد یا کمک به خیریه تبدیل کنید. هر امتیاز = ۱۰۰ تومان.",
    bubble1: "کسی می‌دونه eSIM رو چطور فعال کنم؟", bubble2: "از تنظیمات ← افزودن eSIM، کد QR رو اسکن کن.",
    plansT: "بسته‌ای که با شما تغییر می‌کند", plansSub: "ماهانه و بدون قرارداد. هر وقت خواستید تغییر دهید یا لغو کنید.",
    basic: "هم‌بسته پایه", plus: "هم‌بسته دیتا+", max: "هم‌بسته حرفه‌ای",
    student: "مناسب دانشجوها", popular: "محبوب‌ترین", creator: "فریلنسرها و گیمرها",
    gb: "گیگابایت دیتا", min: "دقیقه مکالمه", sms: "پیامک", k: "هزار تومان", perMonth: "در ماه", choose: "انتخاب این بسته",
    calcT: "قبض‌تان را خودتان کم کنید", calcQ: "هر ماه به چند سوال پاسخ می‌دهید؟", calcSave: "صرفه‌جویی ماهانه",
    calcFree: "بسته دیتا+ شما عملا رایگان شد!", calcOf: "از هزینه بسته دیتا+",
    charT: "امتیازهایتان می‌توانند دنیا را کمی بهتر کنند", charSub: "اعضای هم‌آوا تا امروز این مبالغ را با امتیازهایشان اهدا کرده‌اند.",
    mahak: "محک — حمایت از کودکان مبتلا به سرطان", school: "ساخت مدرسه در مناطق کم‌برخوردار", forest: "کاشت درخت در زاگرس",
    ctaT: "آماده‌اید عضو شوید؟", ctaSub: "ثبت‌نام کمتر از دو دقیقه طول می‌کشد و سیم‌کارت رایگان است.",
    pct: "٪", footer: "هم‌آوا — ساخته‌شده با اعضا، برای اعضا.", toman: "تومان",
    joinT: "سیم‌کارت رایگان‌تان را بگیرید", stepPlan: "بسته", stepInfo: "اطلاعات", stepOk: "تایید",
    name: "نام و نام خانوادگی", phone: "شماره موبایل برای تماس", city: "شهر", esim: "eSIM می‌خواهم",
    esimD: "بدون سیم‌کارت فیزیکی، فعال‌سازی در چند دقیقه", next: "ادامه", back: "بازگشت", submit: "ثبت سفارش",
    empty: "اینجا نباید خالی باشد", phoneErr: "شماره موبایل نادرست است", review: "مرور سفارش",
    free: "رایگان", shipping: "ارسال", simCard: "سیم‌کارت", monthly: "هزینه ماهانه",
    done: "سفارش شما ثبت شد!", doneSub: "سیم‌کارت تا ۴۸ ساعت آینده ارسال می‌شود. وضعیت سفارش: در حال پردازش",
    doneEsim: "کد QR فعال‌سازی eSIM تا چند دقیقه دیگر در پیش‌خوان شما است.", toDash: "رفتن به پیش‌خوان",
    comTitle: "جامعه هم‌آوا", comSub: "سوال بپرسید، پاسخ دهید و برای هر کمک امتیاز بگیرید.",
    search: "جستجو در سوال‌ها", ask: "طرح سوال", answers: "پاسخ", accepted: "پاسخ تاییدشده",
    yourAnswer: "پاسخ شما…", send: "ارسال پاسخ", earned: "امتیاز گرفتید!", noAnswers: "هنوز پاسخی ثبت نشده. اولین نفر باشید.",
    askT: "سوال‌تان را بنویسید", askPh: "مثلا: رومینگ بین‌المللی دارید؟", cancel: "انصراف", post: "ثبت سوال",
    all: "همه", tag_esim: "eSIM", tag_plans: "بسته‌ها", tag_network: "شبکه", tag_general: "عمومی", noResults: "نتیجه‌ای پیدا نشد",
    asked: "سوال شما ثبت شد", err: "مشکلی پیش آمد، دوباره امتحان کنید",
    hello: "سلام", renews: "روز تا تمدید", usage: "مصرف این دوره", of: "از",
    credit: "اعتبار کیف پول", points: "امتیاز", worth: "ارزش", redeem: "تبدیل امتیاز",
    topup: "شارژ", cash: "نقدی", charity: "خیریه", amount: "تعداد امتیاز", confirm: "تایید",
    redeemed: "انجام شد", notEnough: "امتیاز کافی نیست", invite: "دوستانتان را دعوت کنید",
    inviteSub: "برای هر عضو جدید ۵۰۰ امتیاز بگیرید.", copy: "کپی", copied: "کپی شد",
    earn: "راه‌های کسب امتیاز", e_answer: "پاسخ به یک سوال", e_accepted: "پاسخ تاییدشده", e_referral: "معرفی عضو جدید", e_idea: "ایده پذیرفته‌شده",
  },
  en: {
    brand: "Hamava", home: "Home", community: "Community", dashboard: "Dashboard", join: "Free SIM", plans: "Plans",
    theme: "Toggle theme", lang: "فارسی",
    eyebrow: "The community-powered network", h1a: "Mobile,", h1b: "the people's way.",
    heroSub: "No contracts. No call-center queues. Help each other, earn points, and watch your bill shrink.",
    cta: "Get your free SIM", cta2: "See plans",
    chipPts: "points per answer", chipMin: "min to first answer", chipZero: "long contracts",
    sMembers: "active members", sAnswered: "% questions answered", sAvg: "min average response", sDonated: "toman donated",
    howT: "Three simple ideas.", howT2: "One different network.",
    simT: "Free SIM", simD: "Fill a short form and a free SIM or eSIM is on its way. Change your plan any month.",
    comT: "Community support", comD: "Instead of a call center, members help each other — and earn points for every useful answer.",
    rewT: "Rewards club", rewD: "Turn points into top-up, cash, or a donation. 1 point = 100 toman.",
    bubble1: "Anyone know how to activate eSIM?", bubble2: "Settings → Add eSIM, then scan the QR code.",
    plansT: "Plans that change with you", plansSub: "Monthly, no contract. Switch or cancel whenever you like.",
    basic: "Hamava Basic", plus: "Hamava Data+", max: "Hamava Max",
    student: "For students", popular: "Most popular", creator: "Creators & gamers",
    gb: "GB data", min: "minutes", sms: "texts", k: "k toman", perMonth: "/ month", choose: "Choose plan",
    calcT: "Shrink your own bill", calcQ: "How many questions do you answer a month?", calcSave: "Monthly savings",
    calcFree: "Your Data+ plan is now basically free!", calcOf: "of the Data+ price",
    charT: "Your points can make the world a little better", charSub: "What Hamava members have donated with their points so far.",
    mahak: "MAHAK — children with cancer", school: "Schools in underserved regions", forest: "Replanting the Zagros forests",
    ctaT: "Ready to join?", ctaSub: "Sign-up takes under two minutes and the SIM is free.",
    pct: "%", footer: "Hamava — built by members, for members.", toman: "toman",
    joinT: "Get your free SIM", stepPlan: "Plan", stepInfo: "Details", stepOk: "Confirm",
    name: "Full name", phone: "Contact mobile number", city: "City", esim: "I want an eSIM",
    esimD: "No physical card, activate in minutes", next: "Continue", back: "Back", submit: "Place order",
    empty: "This can't be empty", phoneErr: "That mobile number doesn't look right", review: "Review order",
    free: "Free", shipping: "Shipping", simCard: "SIM card", monthly: "Monthly price",
    done: "Your order is in!", doneSub: "Your SIM ships within 48 hours. Status: processing",
    doneEsim: "Your eSIM activation QR will be in your dashboard in a few minutes.", toDash: "Go to dashboard",
    comTitle: "Hamava Community", comSub: "Ask, answer, and earn points for every bit of help.",
    search: "Search questions", ask: "Ask a question", answers: "answers", accepted: "Accepted answer",
    yourAnswer: "Your answer…", send: "Post answer", earned: "points earned!", noAnswers: "No answers yet. Be the first.",
    askT: "What's your question?", askPh: "e.g. Do you offer international roaming?", cancel: "Cancel", post: "Post question",
    all: "All", tag_esim: "eSIM", tag_plans: "Plans", tag_network: "Network", tag_general: "General", noResults: "No results",
    asked: "Question posted", err: "Something went wrong, please try again",
    hello: "Hi", renews: "days until renewal", usage: "This cycle", of: "of",
    credit: "Wallet credit", points: "points", worth: "Worth", redeem: "Redeem points",
    topup: "Top-up", cash: "Cash", charity: "Charity", amount: "Points to redeem", confirm: "Confirm",
    redeemed: "Done", notEnough: "Not enough points", invite: "Invite friends",
    inviteSub: "Get 500 points for every new member.", copy: "Copy", copied: "Copied",
    earn: "Ways to earn", e_answer: "Answer a question", e_accepted: "Accepted answer", e_referral: "Refer a member", e_idea: "Idea adopted",
  },
};
export type Key = keyof typeof dict.fa;

type Ctx = {
  lang: Lang;
  t: (k: Key) => string;
  tr: (l: L) => string;
  n: (x: number, digits?: number) => string;
  toggleLang: () => void;
  toggleTheme: () => void;
  toast: (msg: string) => void;
};
const AppCtx = createContext<Ctx>(null!);
export const useApp = () => useContext(AppCtx);

export function Providers({ lang: initial, children }: { lang: Lang; children: React.ReactNode }) {
  const [lang, setLang] = useState(initial);
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);

  const toggleLang = useCallback(() => {
    const next = lang === "fa" ? "en" : "fa";
    document.cookie = `lang=${next};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = next;
    document.documentElement.dir = next === "fa" ? "rtl" : "ltr";
    setLang(next);
  }, [lang]);

  const toggleTheme = useCallback(() => {
    const el = document.documentElement;
    const next = el.dataset.theme === "dark" ? "light" : "dark";
    const apply = () => (el.dataset.theme = next);
    try { localStorage.setItem("theme", next); } catch {}
    // view transition gives a soft cross-fade where supported
    if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(apply);
    else apply();
  }, []);

  const toast = useCallback((text: string) => {
    const id = Date.now();
    setMsg({ text, id });
    setTimeout(() => setMsg((m) => (m?.id === id ? null : m)), 2600);
  }, []);

  const value: Ctx = {
    lang,
    t: (k) => dict[lang][k],
    tr: (l) => (typeof l === "string" ? l : l[lang]),
    n: (x, digits = 0) => x.toLocaleString(lang === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: digits }),
    toggleLang,
    toggleTheme,
    toast,
  };

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {msg && <div key={msg.id} className="toast glass">{msg.text}</div>}
      </div>
    </AppCtx.Provider>
  );
}
