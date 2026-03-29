import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Clock,
  ScanFace,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { AttendanceRecord, Student } from "../backend";
import { useActor } from "../hooks/useActor";

const TODAY = new Date().toISOString().split("T")[0];

type KpiCardProps = {
  icon: React.ElementType;
  label: string;
  value: number;
  iconBg: string;
  iconColor: string;
  loading: boolean;
};

function KpiCard({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
  loading,
}: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {label}
          </p>
          {loading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-3xl font-bold text-foreground">{value}</p>
          )}
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: iconBg }}
        >
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { actor, isFetching } = useActor();
  const navigate = useNavigate();

  const { data: students = [], isLoading: loadingStudents } = useQuery<
    Student[]
  >({
    queryKey: ["students"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllStudents();
    },
    enabled: !!actor && !isFetching,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["todayStats", TODAY],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getTodaysStats(TODAY);
    },
    enabled: !!actor && !isFetching,
  });

  const { data: records = [], isLoading: loadingRecords } = useQuery<
    AttendanceRecord[]
  >({
    queryKey: ["attendanceRecords"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllAttendanceRecords();
    },
    enabled: !!actor && !isFetching,
  });

  const { data: faces = [], isLoading: loadingFaces } = useQuery({
    queryKey: ["faces"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllFaces();
    },
    enabled: !!actor && !isFetching,
  });

  const totalStudents = students.length;
  const presentToday = Number(stats?.presentCount ?? 0);
  const absentToday = Number(stats?.absentCount ?? 0);
  const enrolledCount = faces.length;

  const recentRecords = [...records]
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
    .slice(0, 5);

  const globalLoading = loadingStudents || loadingStats || isFetching;

  function handleGoAttendance() {
    toast.success("Opening face scan attendance...");
    navigate({ to: "/attendance" });
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm mt-1 text-muted-foreground">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={Users}
          label="Total Students"
          value={totalStudents}
          iconBg="#EFF6FF"
          iconColor="#2563EB"
          loading={globalLoading}
        />
        <KpiCard
          icon={UserCheck}
          label="Present Today"
          value={presentToday}
          iconBg="#F0FDF4"
          iconColor="#16A34A"
          loading={globalLoading}
        />
        <KpiCard
          icon={UserX}
          label="Absent Today"
          value={absentToday}
          iconBg="#FEF2F2"
          iconColor="#DC2626"
          loading={globalLoading}
        />
        <KpiCard
          icon={ScanFace}
          label="Enrolled Faces"
          value={enrolledCount}
          iconBg="#FFF7ED"
          iconColor="#EA580C"
          loading={loadingFaces}
        />
      </div>

      {/* Quick actions + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-xl border border-border bg-white p-6 shadow-card">
          <h2 className="text-base font-semibold text-foreground mb-1">
            Quick Actions
          </h2>
          <p className="text-sm mb-6 text-muted-foreground">
            Open camera to scan face and mark attendance
          </p>
          <Button
            className="w-full h-14 text-base font-semibold gap-3 rounded-xl mb-3 bg-primary text-white hover:bg-primary/90"
            onClick={handleGoAttendance}
            data-ocid="dashboard.scan.primary_button"
          >
            <ScanFace className="h-5 w-5" /> Start Face Scan
          </Button>
          <Button
            variant="outline"
            className="w-full h-11 gap-2 text-sm border-border text-foreground hover:bg-accent"
            onClick={() => navigate({ to: "/students" })}
            data-ocid="dashboard.add_student.secondary_button"
          >
            <UserPlus className="h-4 w-4" />
            Add New Student
          </Button>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-border bg-white p-6 shadow-card">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Recent Activity
          </h2>
          {loadingRecords ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full animate-pulse bg-muted" />
                  <div className="flex-1 space-y-1">
                    <div
                      className="h-3 rounded animate-pulse bg-muted"
                      style={{ width: "60%" }}
                    />
                    <div
                      className="h-2 rounded animate-pulse bg-muted"
                      style={{ width: "40%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : recentRecords.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-8 text-center"
              data-ocid="dashboard.activity.empty_state"
            >
              <Clock className="h-8 w-8 mb-2 text-muted" />
              <p className="text-sm text-muted-foreground">No activity yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRecords.map((r, i) => (
                <div
                  key={`${r.studentId}-${r.timestamp}`}
                  className="flex items-center gap-3"
                  data-ocid={`dashboard.activity.item.${i + 1}`}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold bg-accent text-accent-foreground">
                    {getInitials(r.studentName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {r.studentName}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.time}</p>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                    style={
                      r.status === "IN"
                        ? { background: "#DCFCE7", color: "#16A34A" }
                        : { background: "#FEE2E2", color: "#DC2626" }
                    }
                  >
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-xs mt-8 text-muted-foreground">
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
