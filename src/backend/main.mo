import Array "mo:core/Array";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Time "mo:core/Time";
import List "mo:core/List";
import Order "mo:core/Order";
import Iter "mo:core/Iter";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";



persistent actor {
  // Types
  type Student = {
    id : Text;
    name : Text;
    phone : Text;
    course : Text;
    createdAt : Int;
  };

  type AttendanceRecord = {
    studentId : Text;
    studentName : Text;
    course : Text;
    status : Text;
    date : Text;
    time : Text;
    timestamp : Int;
  };

  type FaceData = {
    studentId : Text;
    faceImage : Text; // base64 encoded face image
    enrolledAt : Int;
  };

  public type UserProfile = {
    username : Text;
  };

  // Struct Definitions
  module Student {
    public func compare(student1 : Student, student2 : Student) : Order.Order {
      return Text.compare(student1.name, student2.name);
    };
  };

  module AttendanceRecord {
    public func compare(record1 : AttendanceRecord, record2 : AttendanceRecord) : Order.Order {
      return Int.compare(record2.timestamp, record1.timestamp);
    };
  };

  module FaceData {
    public func compare(data1 : FaceData, data2 : FaceData) : Order.Order {
      return Int.compare(data2.enrolledAt, data1.enrolledAt);
    };
  };

  // Internal state
  let students = Map.empty<Text, Student>();
  let attendanceRecords = Map.empty<Text, AttendanceRecord>();
  let faceData = Map.empty<Text, FaceData>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // User Profile Management
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Student Management
  public shared ({ caller }) func addStudent(student : Student) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can add students");
    };
    if (students.size() > 0 and students.containsKey(student.id)) {
      Runtime.trap("Student with this ID already exists");
    };
    students.add(student.id, student);
  };

  public shared ({ caller }) func updateStudent(id : Text, student : Student) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can update students");
    };
    if (not students.containsKey(id)) {
      Runtime.trap("Student not found");
    };
    students.add(id, student);
  };

  public shared ({ caller }) func deleteStudent(id : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can delete students");
    };
    if (not students.containsKey(id)) {
      Runtime.trap("Student not found");
    };
    students.remove(id);
  };

  public query ({ caller }) func getStudent(id : Text) : async Student {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view student data");
    };
    switch (students.get(id)) {
      case (null) { Runtime.trap("Student not found") };
      case (?student) { student };
    };
  };

  public query ({ caller }) func getAllStudents() : async [Student] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view student data");
    };
    students.values().toArray().sort();
  };

  // Face Enrollment
  public shared ({ caller }) func enrollFace(data : FaceData) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can enroll faces");
    };
    faceData.add(data.studentId, data);
  };

  public query ({ caller }) func getFace(studentId : Text) : async FaceData {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view face data");
    };
    switch (faceData.get(studentId)) {
      case (null) { Runtime.trap("Face data not found") };
      case (?data) { data };
    };
  };

  public query ({ caller }) func getAllFaces() : async [FaceData] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view face data");
    };
    faceData.values().toArray().sort();
  };

  // Attendance
  public shared ({ caller }) func markAttendance(record : AttendanceRecord) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can mark attendance");
    };
    let key = record.studentId # "_" # record.date # "_" # record.status;
    if (attendanceRecords.containsKey(key)) {
      Runtime.trap("Attendance already marked for this status");
    };
    attendanceRecords.add(key, record);
  };

  public query ({ caller }) func getAttendanceRecord(id : Text) : async AttendanceRecord {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view attendance records");
    };
    switch (attendanceRecords.get(id)) {
      case (null) { Runtime.trap("Attendance record not found") };
      case (?record) { record };
    };
  };

  public query ({ caller }) func getAllAttendanceRecords() : async [AttendanceRecord] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view attendance records");
    };
    attendanceRecords.values().toArray().sort();
  };

  public query ({ caller }) func getTodaysStats(date : Text) : async {
    totalStudents : Nat;
    presentCount : Nat;
    absentCount : Nat;
  } {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view attendance statistics");
    };
    let total = students.size();
    var present = 0;

    attendanceRecords.values().forEach(func(record) { if (record.date == date and record.status == "IN") { present += 1 } });

    {
      totalStudents = total;
      presentCount = present;
      absentCount = if (total > present) { total - present } else { 0 };
    };
  };

  public query ({ caller }) func getUnmarkedStudents(date : Text) : async [Student] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view unmarked students");
    };
    let allStudents = students.values().toArray();
    let unmarked = List.empty<Student>();

    allStudents.forEach(
      func(student) {
        let hasMarked = attendanceRecords.values().toArray().any(
          func(record) { record.date == date and record.studentId == student.id }
        );
        if (not hasMarked) {
          unmarked.add(student);
        };
      }
    );
    unmarked.toArray();
  };
};
