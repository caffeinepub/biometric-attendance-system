import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Printer,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AttendanceRecord, Student } from "../backend";
import { useActor } from "../hooks/useActor";
import { exportToCSV } from "../lib/csvExport";

const PAGE_SIZE = 10;

const COURSES = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Biology",
  "English",
  "Computer Science",
];

function getDayLabel(date: Date) {
  return date.toLocaleDateString("en-IN", { weekday: "short" });
}

function getDateStr(date: Date) {
  return date.toISOString().split("T")[0];
}

export default function ReportsPage() {
  const { actor, isFetching } = useActor();

  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const { data: records = [], isLoading: recordsLoading } = useQuery<
    AttendanceRecord[]
  >({
    queryKey: ["attendanceRecords"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllAttendanceRecords();
    },
    enabled: !!actor && !isFetching,
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery<
    Student[]
  >({
    queryKey: ["allStudents"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllStudents();
    },
    enabled: !!actor && !isFetching,
  });

  const isLoading = recordsLoading || studentsLoading;

  // ── Weekly bar chart (last 7 days) ──
  const weeklyData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const dateStr = getDateStr(d);
      const presentCount = records.filter(
        (r) => r.date === dateStr && r.status === "IN",
      ).length;
      return { day: getDayLabel(d), present: presentCount, date: dateStr };
    });
  }, [records]);

  // ── Monthly line chart (last 4 weeks avg %) ──
  const monthlyData = useMemo(() => {
    const today = new Date();
    const totalStudents = students.length || 1;
    return Array.from({ length: 4 }, (_, i) => {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (3 - i) * 7 - 6);
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - (3 - i) * 7);

      const weekDates: string[] = [];
      const cursor = new Date(weekStart);
      while (cursor <= weekEnd) {
        weekDates.push(getDateStr(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }

      const daysWithData = new Set(
        records.map((r) => r.date).filter((d) => weekDates.includes(d)),
      ).size;
      if (daysWithData === 0) return { week: `Week ${i + 1}`, avgPct: 0 };

      const totalPresent = records.filter(
        (r) => weekDates.includes(r.date) && r.status === "IN",
      ).length;

      const avgPct = Math.round(
        (totalPresent / (daysWithData * totalStudents)) * 100,
      );
      return { week: `Week ${i + 1}`, avgPct };
    });
  }, [records, students]);

  // ── Student-wise stats ──
  const studentStats = useMemo(() => {
    const dateSet = new Set(records.map((r) => r.date));
    const totalSessions = dateSet.size || 1;

    return students
      .map((s) => {
        const studentRecords = records.filter((r) => r.studentId === s.id);
        const present = studentRecords.filter((r) => r.status === "IN").length;
        const absent = totalSessions - present;
        const pct = Math.round((present / totalSessions) * 100);
        return {
          id: s.id,
          name: s.name,
          course: s.course,
          totalSessions,
          present,
          absent: Math.max(0, absent),
          pct,
        };
      })
      .sort((a, b) => a.pct - b.pct);
  }, [students, records]);

  // ── Low attendance alerts ──
  const lowAttendance = useMemo(
    () => studentStats.filter((s) => s.pct < 75),
    [studentStats],
  );

  // ── Records tab filters ──
  const filtered = useMemo(() => {
    return records
      .filter((r) => {
        const matchSearch =
          r.studentName.toLowerCase().includes(search.toLowerCase()) ||
          r.course.toLowerCase().includes(search.toLowerCase());
        const matchCourse = courseFilter === "all" || r.course === courseFilter;
        const matchFrom = !fromDate || r.date >= fromDate;
        const matchTo = !toDate || r.date <= toDate;
        return matchSearch && matchCourse && matchFrom && matchTo;
      })
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  }, [records, search, courseFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleExportCSV() {
    exportToCSV(
      filtered,
      `attendance-report-${new Date().toISOString().split("T")[0]}.csv`,
    );
  }

  function handleExportPDF() {
    window.print();
  }

  function handlePageChange(newPage: number) {
    setPage(Math.max(1, Math.min(totalPages, newPage)));
  }

  return (
    <div>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          aside, header, nav { display: none !important; }
          main { padding: 0 !important; overflow: visible !important; }
          body { background: white !important; }
          @page { orientation: landscape; margin: 1cm; }
          .print-full-table table { page-break-inside: auto; }
          .print-full-table tr { page-break-inside: avoid; }
        }
      `}</style>

      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm mt-0.5 text-muted-foreground">
            Attendance analytics &amp; records
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2 text-sm font-semibold"
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            data-ocid="reports.export.button"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            className="gap-2 text-sm font-semibold bg-primary text-white hover:bg-primary/90"
            onClick={handleExportPDF}
            data-ocid="reports.pdf.button"
          >
            <Printer className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="no-print bg-white border border-border rounded-xl p-1 gap-1 h-auto">
          <TabsTrigger
            value="overview"
            className="rounded-lg px-5 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-white"
            data-ocid="reports.overview.tab"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="studentwise"
            className="rounded-lg px-5 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-white"
            data-ocid="reports.studentwise.tab"
          >
            Student-wise
          </TabsTrigger>
          <TabsTrigger
            value="records"
            className="rounded-lg px-5 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-white"
            data-ocid="reports.records.tab"
          >
            Records
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Overview ── */}
        <TabsContent value="overview" className="space-y-5">
          {isLoading ? (
            <div
              className="flex justify-center py-16"
              data-ocid="reports.loading_state"
            >
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Weekly Bar Chart */}
                <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-foreground mb-1">
                    Weekly Attendance
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Present count — last 7 days
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={weeklyData} barSize={28}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="oklch(var(--border))"
                      />
                      <XAxis
                        dataKey="day"
                        tick={{
                          fontSize: 11,
                          fill: "oklch(var(--muted-foreground))",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{
                          fontSize: 11,
                          fill: "oklch(var(--muted-foreground))",
                        }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "white",
                          border: "1px solid oklch(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ fontWeight: 600 }}
                        formatter={(value: number) => [value, "Present"]}
                      />
                      <Bar
                        dataKey="present"
                        fill="oklch(0.546 0.245 264)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Monthly Line Chart */}
                <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-foreground mb-1">
                    Monthly Trend
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Avg. attendance % — last 4 weeks
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="oklch(var(--border))"
                      />
                      <XAxis
                        dataKey="week"
                        tick={{
                          fontSize: 11,
                          fill: "oklch(var(--muted-foreground))",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{
                          fontSize: 11,
                          fill: "oklch(var(--muted-foreground))",
                        }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "white",
                          border: "1px solid oklch(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(value: number) => [
                          `${value}%`,
                          "Avg Attendance",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgPct"
                        stroke="oklch(0.546 0.245 264)"
                        strokeWidth={2.5}
                        dot={{ fill: "oklch(0.546 0.245 264)", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Low Attendance Alerts */}
              <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Low Attendance Alerts
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    (below 75%)
                  </span>
                  {lowAttendance.length > 0 && (
                    <Badge variant="destructive" className="ml-auto text-xs">
                      {lowAttendance.length} student
                      {lowAttendance.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                {lowAttendance.length === 0 ? (
                  <div
                    className="flex items-center gap-2 py-3"
                    data-ocid="reports.alerts.success_state"
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <p className="text-sm text-green-700 font-medium">
                      All students are above 75% attendance
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2" data-ocid="reports.alerts.list">
                    {lowAttendance.map((s, i) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg bg-red-50 border border-red-100 px-4 py-2.5"
                        data-ocid={`reports.alert.item.${i + 1}`}
                      >
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {s.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {s.course}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 font-bold">
                          {s.pct}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Tab 2: Student-wise ── */}
        <TabsContent value="studentwise">
          <div className="rounded-xl border border-border bg-white overflow-hidden shadow-sm">
            {isLoading ? (
              <div
                className="flex justify-center py-16"
                data-ocid="reports.studentwise.loading_state"
              >
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : students.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16"
                data-ocid="reports.studentwise.empty_state"
              >
                <p className="text-sm text-muted-foreground">
                  No students found
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted border-b border-border">
                      {[
                        "Student",
                        "Course",
                        "Sessions",
                        "Present",
                        "Absent",
                        "Attendance",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {studentStats.map((s, i) => (
                      <tr
                        key={s.id}
                        className="border-b border-border hover:bg-muted/50 transition-colors"
                        data-ocid={`reports.student.item.${i + 1}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {s.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {s.course}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground text-center">
                          {s.totalSessions}
                        </td>
                        <td className="px-4 py-3 text-sm text-green-600 font-medium text-center">
                          {s.present}
                        </td>
                        <td className="px-4 py-3 text-sm text-red-500 font-medium text-center">
                          {s.absent}
                        </td>
                        <td className="px-4 py-3 min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={s.pct}
                              className="h-2 flex-1"
                              style={
                                {
                                  // @ts-ignore
                                  "--progress-color":
                                    s.pct >= 75
                                      ? "oklch(0.6 0.2 142)"
                                      : "oklch(0.577 0.245 27)",
                                } as React.CSSProperties
                              }
                            />
                            <span
                              className={`text-xs font-bold w-10 text-right ${
                                s.pct >= 75 ? "text-green-600" : "text-red-500"
                              }`}
                            >
                              {s.pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Tab 3: Records ── */}
        <TabsContent value="records">
          {/* Filters */}
          <div className="rounded-xl border border-border bg-white p-4 mb-5 shadow-sm no-print">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search student or course..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 bg-white"
                  data-ocid="reports.search.input"
                />
              </div>
              <Select
                value={courseFilter}
                onValueChange={(v) => {
                  setCourseFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="bg-white"
                  data-ocid="reports.course.select"
                >
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {COURSES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="bg-white"
                data-ocid="reports.from_date.input"
              />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="bg-white"
                data-ocid="reports.to_date.input"
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border bg-white overflow-hidden shadow-sm print-full-table">
            {recordsLoading ? (
              <div
                className="flex justify-center py-16"
                data-ocid="reports.records.loading_state"
              >
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : paginated.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16"
                data-ocid="reports.records.empty_state"
              >
                <Download className="h-8 w-8 mb-2 text-muted" />
                <p className="text-sm text-muted-foreground">
                  No records match your filters
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted border-b border-border">
                        {[
                          "Date",
                          "Student Name",
                          "Course",
                          "Time",
                          "Status",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((r, i) => (
                        <tr
                          key={`${r.studentId}-${r.timestamp}`}
                          className="border-b border-border hover:bg-muted/50 transition-colors"
                          data-ocid={`reports.item.${i + 1}`}
                        >
                          <td className="px-4 py-3 text-sm text-foreground">
                            {r.date}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-foreground">
                            {r.studentName}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {r.course}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {r.time}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs px-2.5 py-1 rounded-full font-semibold"
                              style={
                                r.status === "IN"
                                  ? { background: "#DCFCE7", color: "#16A34A" }
                                  : { background: "#FEE2E2", color: "#DC2626" }
                              }
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div
                  className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted no-print"
                  data-ocid="reports.pagination.panel"
                >
                  <p className="text-xs text-muted-foreground">
                    Showing {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
                    {filtered.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 bg-white"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 1}
                      data-ocid="reports.pagination_prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs px-2 text-foreground font-medium">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 bg-white"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page === totalPages}
                      data-ocid="reports.pagination_next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <p className="text-center text-xs mt-8 text-muted-foreground no-print">
        © {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          caffeine.ai
        </a>
      </p>
    </div>
  );
}
