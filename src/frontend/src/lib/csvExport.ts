import type { AttendanceRecord } from "../backend";

export function exportToCSV(
  records: AttendanceRecord[],
  filename: string,
): void {
  const header = "Date,Student Name,Course,Time,Status";
  const rows = records.map((r) =>
    [
      r.date,
      `"${r.studentName.replace(/"/g, '""')}"`,
      `"${r.course.replace(/"/g, '""')}"`,
      r.time,
      r.status,
    ].join(","),
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
