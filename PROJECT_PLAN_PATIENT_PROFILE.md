# Patient Profile Plan (Mobile App)

> الهدف: بناء ملف طبي شامل لكل مراجع يُعرض للطبيب مباشرة عند حجز موعد جديد، ويحتوي على السجل الطبي السابق والتشخيصات والحالة المرضية والمراجعات السابقة بشكل منظم وسهل الاستخدام.

---

## 1) نطاق الخطة (Scope)
- حفظ جميع المراجعات السابقة لكل مراجع.
- حفظ الحالة المرضية الحالية والتشخيصات السابقة.
- عرض ملف المراجع للطبيب تلقائيا عند فتح تفاصيل الموعد.
- بيانات واضحة وقابلة للتحديث مع سجل زمني كامل.
- احترام الخصوصية والصلاحيات.

## 2) تجربة المستخدم (Doctor UX)
- عند فتح موعد جديد، تظهر بطاقة "ملف المراجع" أعلى تفاصيل الموعد.
- عرض سريع:
  - التشخيص الاخير.
  - الادوية الحالية.
  - الامراض المزمنة.
  - الحساسية.
  - اخر زيارة وتاريخها.
- زر "عرض الملف الكامل" يفتح صفحة تفصيلية.
- صفحة الملف الكامل تتضمن Tabs:
  - ملخص طبي.
  - تاريخ الزيارات.
  - الادوية والوصفات.
  - فحوصات ونتائج.
  - المرفقات والصور.

## 3) البيانات المطلوب حفظها (Patient Medical Profile)
### 3.1 معلومات اساسية
- patientId
- الاسم الكامل
- الجنس
- تاريخ الميلاد / العمر
- الهاتف
- البريد
- العنوان
- جهة الطوارئ (اسم + هاتف)

### 3.2 الحالة المرضية الحالية
- chiefComplaint (الشكوى الرئيسية)
- currentCondition (الحالة الحالية)
- vitals (اختياري)
  - ضغط الدم
  - الحرارة
  - النبض
  - السكر

### 3.3 تاريخ مرضي
- chronicConditions (امراض مزمنة)
- pastSurgeries (عمليات سابقة)
- allergies (حساسية)
- familyHistory (تاريخ عائلي)

### 3.4 التشخيصات السابقة
- diagnosisHistory[]
  - diagnosis
  - date
  - doctorId
  - notes

### 3.5 الادوية
- currentMedications[]
  - name
  - dose
  - frequency
  - startDate
  - endDate

### 3.6 الزيارات السابقة
- visits[]
  - visitId
  - date
  - doctorId
  - reason
  - diagnosis
  - notes
  - prescriptions[]
  - attachments[]

### 3.7 الفحوصات
- labResults[]
  - testName
  - date
  - result
  - attachments[]

### 3.8 المرفقات
- attachments[]
  - type (image/pdf)
  - url
  - uploadedAt
  - uploadedBy

## 4) نموذج البيانات (Backend)
### 4.1 جدول/Collection جديد: PatientProfile
- patientId (unique)
- basics (object)
- currentCondition (object)
- medicalHistory (object)
- diagnosisHistory (array)
- currentMedications (array)
- visits (array)
- labResults (array)
- attachments (array)
- createdAt, updatedAt

### 4.2 تحديث عند كل مراجعة
- عند انتهاء الموعد، يتم حفظ:
  - diagnosis
  - doctor notes
  - prescriptions
  - attachments
- يتم دفع هذا البيانات الى visits[] مع timestamp.

## 5) نقاط الربط (APIs)
### 5.1 GET
- GET /api/patients/:id/profile
  - يرجع ملف المراجع الكامل

### 5.2 PATCH
- PATCH /api/patients/:id/profile
  - تحديث معلومات اساسية او التاريخ المرضي

### 5.3 POST
- POST /api/patients/:id/visit
  - اضافة زيارة جديدة بعد الموعد

## 6) واجهات الجوال (Mobile Screens)
### 6.1 شاشة: PatientProfileSummary (ضمن تفاصيل الموعد)
- عرض الملخص الطبي.
- زر "عرض الملف الكامل".

### 6.2 شاشة: PatientProfileFull
- Tabs / Sections.
- قابلة للبحث في الزيارات.

### 6.3 شاشة: AddVisitSummary
- للطبيب بعد انتهاء الموعد.
- حقول: تشخيص، خطة علاج، وصفة، مرفقات.

## 7) صلاحيات وخصوصية
- الطبيب يرى فقط مرضاه.
- المراجع يرى ملفه فقط.
- سجل تعديلات واضح (Audit Log).

## 8) خطة التنفيذ (Phases)
### Phase 1 (MVP)
- PatientProfile model.
- API: get profile + add visit.
- عرض ملخص داخل تفاصيل الموعد.

### Phase 2
- ملفات مرفقة + فحوصات.
- تحسين UI للملف الكامل.

### Phase 3
- تحليلات وتجميع بيانات اقدم.
- تقارير PDF + طباعة.

## 9) ملاحظات تنفيذ مهمة
- استخدام patientId كمرجع رئيسي.
- الكاش في الجوال لتسريع عرض الملف.
- حماية قوية للبيانات الطبية.

---

## 10) Ready Checklist
- [ ] إنشاء PatientProfile collection/model
- [ ] إنشاء API endpoints
- [ ] ربط عرض الملف داخل موعد الطبيب
- [ ] حفظ الزيارة بعد انتهاء الموعد
- [ ] إضافة صور ومرفقات
- [ ] اختبار الصلاحيات

---

## ملاحظة
هذه الخطة قابلة للتطوير واضافة تفاصيل اكثر حسب حاجة العيادة او التخصص.
