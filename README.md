# INFO3020 · Giữa kỳ — EDA bộ dữ liệu IBM HR Employee Attrition

**Sinh viên:** Phan Hoàng Bách  
**Repository:** https://github.com/bachph2005-hash/INFO3020-EDA-Attrition  
**Câu hỏi nghiên cứu:** Nhóm nhân viên nào có tỷ lệ nghỉ việc cao nhất, và yếu tố nào vẫn gắn với nghỉ việc khi so sánh trong cùng cấp bậc công việc?

## Cấu trúc

```
data/raw/EmployeeAttrition.csv        dữ liệu gốc (không sửa)
notebooks/eda_attrition.ipynb         notebook chính — Restart & Run All; mọi bảng, biểu đồ hiện ngay trong notebook
notebooks/EmployeeAttrition.csv       bản sao dữ liệu đặt cạnh notebook (notebook đọc file này)
src/eda_attrition.py                  cùng nội dung notebook, dạng script (jupytext)
outputs/, data/processed/             hình và bảng đã dùng để dựng báo cáo PDF (notebook không ghi ra các file này)
report/                               báo cáo PDF/DOCX và script tạo báo cáo
```

## Chạy lại

```bash
pip install -r requirements.txt
jupyter notebook notebooks/eda_attrition.ipynb   # Kernel → Restart & Run All
```

Notebook chỉ đọc `EmployeeAttrition.csv` nằm cùng thư mục với notebook, không ghi file nào; xoá ngẫu nhiên 10% dòng với random_state = 1 đến 5. Cần pandas ≥ 2.1 (dùng `DataFrame.map`).

## Ngoại lai (outlier)

Notebook mục 3.1 / báo cáo mục 3.2: boxplot 11 biến số; so sánh Z-score, Z-score cải tiến (MAD) và IQR; không có giá trị không thể có; 114 ngoại lai thu nhập đều là cấp 4–5; bỏ toàn bộ 235 dòng ngoại lai thì tỷ lệ nghỉ đổi tối đa 3,2 điểm %, không kết luận nào đổi chiều → giữ toàn bộ, dùng trung vị, Spearman và so sánh trong cùng cấp.

## Phát hiện chính

1. Làm thêm giờ: nghỉ việc 30,5% so với 10,4% (×2,9), còn nguyên ở mọi cấp bậc, nhóm tuổi, phòng ban.
2. Thâm niên 0–1 năm: 34,9% nghỉ (×4,3 so với nhóm trên 10 năm), mạnh nhất ở người dưới 30 tuổi.
3. Thu nhập thấp đi kèm nghỉ việc chủ yếu do cấp bậc (ρ = 0,92); trong cùng cấp, chênh thu nhập chỉ 0 đến −10%.
4. Sales Representative 39,8% — trùng nhóm trẻ, cấp 1.
5. Độc thân nghỉ gần gấp đôi ở mọi nhóm tuổi — nhưng 100% người độc thân có StockOptionLevel = 0.

Mọi kết quả là mối liên hệ trong dữ liệu giả lập do IBM tạo, không phải quan hệ nhân quả.

Nguồn dữ liệu: IBM HR Analytics Employee Attrition & Performance — Kaggle (pavansubhasht/ibm-hr-analytics-attrition-dataset), OpenML ID 43696.
