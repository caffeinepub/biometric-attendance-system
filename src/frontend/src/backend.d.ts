import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface FaceData {
    studentId: string;
    faceImage: string;
    enrolledAt: bigint;
}
export interface AttendanceRecord {
    status: string;
    studentId: string;
    studentName: string;
    date: string;
    time: string;
    timestamp: bigint;
    course: string;
}
export interface UserProfile {
    username: string;
}
export interface Student {
    id: string;
    name: string;
    createdAt: bigint;
    phone: string;
    course: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addStudent(student: Student): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    deleteStudent(id: string): Promise<void>;
    enrollFace(data: FaceData): Promise<void>;
    getAllAttendanceRecords(): Promise<Array<AttendanceRecord>>;
    getAllFaces(): Promise<Array<FaceData>>;
    getAllStudents(): Promise<Array<Student>>;
    getAttendanceRecord(id: string): Promise<AttendanceRecord>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getFace(studentId: string): Promise<FaceData>;
    getStudent(id: string): Promise<Student>;
    getTodaysStats(date: string): Promise<{
        totalStudents: bigint;
        presentCount: bigint;
        absentCount: bigint;
    }>;
    getUnmarkedStudents(date: string): Promise<Array<Student>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    markAttendance(record: AttendanceRecord): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    updateStudent(id: string, student: Student): Promise<void>;
}
