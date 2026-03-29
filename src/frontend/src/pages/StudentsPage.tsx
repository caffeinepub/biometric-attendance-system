import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Edit2,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Student } from "../backend";
import FaceCaptureModal from "../components/FaceCaptureModal";
import { useActor } from "../hooks/useActor";

const COURSES = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Biology",
  "English",
  "Computer Science",
];

interface StudentFormData {
  name: string;
  phone: string;
  course: string;
  id: string;
}

const EMPTY_FORM: StudentFormData = { name: "", phone: "", course: "", id: "" };

export default function StudentsPage() {
  const { actor, isFetching } = useActor();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [deleteStudent, setDeleteStudentTarget] = useState<Student | null>(
    null,
  );
  const [enrollStudent, setEnrollStudent] = useState<Student | null>(null);
  const [faceCaptureOpen, setFaceCaptureOpen] = useState(false);
  const [addFaceCaptureOpen, setAddFaceCaptureOpen] = useState(false);
  const [capturedFaceForAdd, setCapturedFaceForAdd] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState<StudentFormData>(EMPTY_FORM);

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ["students"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllStudents();
    },
    enabled: !!actor && !isFetching,
  });

  const addWithFaceMutation = useMutation({
    mutationFn: async ({
      student,
      faceImage,
    }: { student: Student; faceImage: string | null }) => {
      if (!actor) throw new Error("Not connected");
      await actor.addStudent(student);
      if (faceImage) {
        await actor.enrollFace({
          studentId: student.id,
          faceImage,
          enrolledAt: BigInt(Date.now()),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["faces"] });
      toast.success("Student added successfully");
      setAddOpen(false);
      setForm(EMPTY_FORM);
      setCapturedFaceForAdd(null);
    },
    onError: () => toast.error("Failed to add student"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, student }: { id: string; student: Student }) => {
      if (!actor) throw new Error("Not connected");
      await actor.updateStudent(id, student);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      toast.success("Student updated");
      setEditStudent(null);
    },
    onError: () => toast.error("Failed to update student"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Not connected");
      await actor.deleteStudent(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      toast.success("Student deleted");
      setDeleteStudentTarget(null);
    },
    onError: () => toast.error("Failed to delete student"),
  });

  const enrollMutation = useMutation({
    mutationFn: async ({
      studentId,
      faceImage,
    }: { studentId: string; faceImage: string }) => {
      if (!actor) throw new Error("Not connected");
      await actor.enrollFace({
        studentId,
        faceImage,
        enrolledAt: BigInt(Date.now()),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faces"] });
      toast.success("Face enrolled successfully");
      setEnrollStudent(null);
      setFaceCaptureOpen(false);
    },
    onError: () => toast.error("Failed to enroll face"),
  });

  const filtered = students.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.phone.includes(search);
    const matchCourse = courseFilter === "all" || s.course === courseFilter;
    return matchSearch && matchCourse;
  });

  function openAdd() {
    setForm({ ...EMPTY_FORM, id: `STU${Date.now().toString().slice(-6)}` });
    setCapturedFaceForAdd(null);
    setAddOpen(true);
  }

  function openEdit(s: Student) {
    setForm({ name: s.name, phone: s.phone, course: s.course, id: s.id });
    setEditStudent(s);
  }

  function submitAdd() {
    if (!form.name || !form.phone || !form.course) {
      toast.error("Please fill all fields");
      return;
    }
    addWithFaceMutation.mutate({
      student: {
        id: form.id,
        name: form.name,
        phone: form.phone,
        course: form.course,
        createdAt: BigInt(Date.now()),
      },
      faceImage: capturedFaceForAdd,
    });
  }

  function submitEdit() {
    if (!editStudent || !form.name || !form.phone || !form.course) {
      toast.error("Please fill all fields");
      return;
    }
    updateMutation.mutate({
      id: editStudent.id,
      student: {
        id: editStudent.id,
        name: form.name,
        phone: form.phone,
        course: form.course,
        createdAt: editStudent.createdAt,
      },
    });
  }

  function handleFaceCaptured(faceImage: string) {
    if (!enrollStudent) return;
    enrollMutation.mutate({ studentId: enrollStudent.id, faceImage });
  }

  function handleFaceCapturedForAdd(faceImage: string) {
    setCapturedFaceForAdd(faceImage);
    setAddFaceCaptureOpen(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Students</h1>
          <p className="text-sm mt-0.5 text-muted-foreground">
            {students.length} total students
          </p>
        </div>
        <Button
          className="gap-2 text-sm font-semibold bg-primary text-white hover:bg-primary/90"
          onClick={openAdd}
          data-ocid="students.add_student.button"
        >
          <UserPlus className="h-4 w-4" />
          Add Student
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
            data-ocid="students.search.input"
          />
        </div>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger
            className="w-full sm:w-48 bg-white"
            data-ocid="students.course.select"
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
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white overflow-hidden shadow-card">
        {isLoading ? (
          <div
            className="flex items-center justify-center py-16"
            data-ocid="students.loading_state"
          >
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            data-ocid="students.empty_state"
          >
            <UserPlus className="h-10 w-10 mb-3 text-muted" />
            <p className="text-sm font-medium text-foreground">
              No students found
            </p>
            <p className="text-xs mt-1 text-muted-foreground">
              Add your first student to get started
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted border-b border-border">
                  {["Student ID", "Name", "Phone", "Course", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr
                    key={s.id}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                    data-ocid={`students.item.${i + 1}`}
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-accent text-accent-foreground font-medium">
                        {s.id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {s.phone}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-foreground font-medium">
                        {s.course}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(s)}
                          title="Edit"
                          data-ocid={`students.edit_button.${i + 1}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded hover:bg-blue-50 transition-colors text-blue-500 hover:text-blue-700"
                          onClick={() => {
                            setEnrollStudent(s);
                            setFaceCaptureOpen(true);
                          }}
                          title="Enroll Face"
                          data-ocid={`students.enroll.button.${i + 1}`}
                        >
                          <Camera className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded hover:bg-red-50 transition-colors text-red-400 hover:text-red-600"
                          onClick={() => setDeleteStudentTarget(s)}
                          title="Delete"
                          data-ocid={`students.delete_button.${i + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setCapturedFaceForAdd(null);
        }}
      >
        <DialogContent data-ocid="students.add.dialog">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
          </DialogHeader>
          <StudentForm form={form} setForm={setForm} />

          {/* Face Scan Section */}
          <div className="rounded-lg border border-border bg-muted p-3">
            <Label className="text-xs mb-3 block text-muted-foreground">
              Face Photo (optional)
            </Label>
            {capturedFaceForAdd ? (
              <div className="flex items-center gap-3">
                <img
                  src={capturedFaceForAdd}
                  alt="Captured face"
                  className="w-20 h-20 rounded-lg object-cover border border-border"
                />
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-foreground">
                    Face captured ✓
                  </p>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium bg-white border border-border text-muted-foreground hover:bg-accent transition-colors"
                    onClick={() => setAddFaceCaptureOpen(true)}
                    data-ocid="students.add.face_retake.button"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retake
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-md font-semibold transition-colors bg-primary text-white hover:bg-primary/90 w-full justify-center"
                onClick={() => setAddFaceCaptureOpen(true)}
                data-ocid="students.add.scan_face.button"
              >
                <Camera className="h-4 w-4" />
                Scan Face
              </button>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setAddOpen(false);
                setCapturedFaceForAdd(null);
              }}
              data-ocid="students.add.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={submitAdd}
              disabled={addWithFaceMutation.isPending}
              className="bg-primary text-white hover:bg-primary/90"
              data-ocid="students.add.submit_button"
            >
              {addWithFaceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Add Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog
        open={!!editStudent}
        onOpenChange={(o) => !o && setEditStudent(null)}
      >
        <DialogContent data-ocid="students.edit.dialog">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          <StudentForm form={form} setForm={setForm} disableId />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditStudent(null)}
              data-ocid="students.edit.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={submitEdit}
              disabled={updateMutation.isPending}
              className="bg-primary text-white hover:bg-primary/90"
              data-ocid="students.edit.submit_button"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={!!deleteStudent}
        onOpenChange={(o) => !o && setDeleteStudentTarget(null)}
      >
        <AlertDialogContent data-ocid="students.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteStudent?.name}</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="students.delete.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteStudent && deleteMutation.mutate(deleteStudent.id)
              }
              data-ocid="students.delete.confirm_button"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Enroll Face — FaceCaptureModal (from table row) */}
      <FaceCaptureModal
        open={faceCaptureOpen && !!enrollStudent}
        studentName={enrollStudent?.name}
        onCapture={handleFaceCaptured}
        onClose={() => {
          setFaceCaptureOpen(false);
          setEnrollStudent(null);
        }}
      />

      {/* Face Capture Modal for Add Student flow */}
      <FaceCaptureModal
        open={addFaceCaptureOpen}
        studentName={form.name || "New Student"}
        onCapture={handleFaceCapturedForAdd}
        onClose={() => setAddFaceCaptureOpen(false)}
      />

      {/* Enroll in-progress overlay */}
      {enrollMutation.isPending && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30">
          <div className="rounded-xl bg-white border border-border p-6 flex items-center gap-4 shadow-card">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">
              Saving face data...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentForm({
  form,
  setForm,
  disableId,
}: {
  form: { name: string; phone: string; course: string; id: string };
  setForm: (f: {
    name: string;
    phone: string;
    course: string;
    id: string;
  }) => void;
  disableId?: boolean;
}) {
  return (
    <div className="grid gap-4 py-2">
      <div>
        <Label className="text-xs mb-1.5 block text-muted-foreground">
          Student ID
        </Label>
        <Input
          value={form.id}
          onChange={(e) => setForm({ ...form, id: e.target.value })}
          disabled={disableId}
          className="bg-white"
          data-ocid="students.form.id.input"
        />
      </div>
      <div>
        <Label className="text-xs mb-1.5 block text-muted-foreground">
          Full Name
        </Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Enter student name"
          className="bg-white"
          data-ocid="students.form.name.input"
        />
      </div>
      <div>
        <Label className="text-xs mb-1.5 block text-muted-foreground">
          Phone Number
        </Label>
        <Input
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="Enter phone number"
          className="bg-white"
          data-ocid="students.form.phone.input"
        />
      </div>
      <div>
        <Label className="text-xs mb-1.5 block text-muted-foreground">
          Course
        </Label>
        <Select
          value={form.course}
          onValueChange={(v) => setForm({ ...form, course: v })}
        >
          <SelectTrigger
            className="bg-white"
            data-ocid="students.form.course.select"
          >
            <SelectValue placeholder="Select course" />
          </SelectTrigger>
          <SelectContent>
            {[
              "Physics",
              "Chemistry",
              "Mathematics",
              "Biology",
              "English",
              "Computer Science",
            ].map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
