export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const DAY_LABELS = {
  sun: "الأحد",
  mon: "الاثنين",
  tue: "الثلاثاء",
  wed: "الأربعاء",
  thu: "الخميس",
  fri: "الجمعة",
  sat: "السبت",
};

export const DEFAULT_SCHEDULE = {
  activeDays: ["mon", "tue", "wed", "thu", "fri"],
  startTime: "09:00",
  endTime: "17:00",
  breakEnabled: true,
  breakFrom: "13:00",
  breakTo: "14:00",
  duration: 20,
  allowOnline: true,
  emergency: false,
};
