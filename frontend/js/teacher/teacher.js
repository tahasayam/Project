document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "../login.html";
    return;
  }

  fetchTeacherProfile();

  document.querySelector(".sign-out")?.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("token");
    window.location.href = "../login.html";
  });
});

async function fetchTeacherProfile() {
  const token = localStorage.getItem("token");
  try {
    const response = await fetch("/api/teachers/profile", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        window.location.href = "../login.html";
        return;
    }

    const data = await response.json();
    
    // Update Profile UI
    document.getElementById("teacher-name").innerText = data.FullName;
    document.getElementById("teacher-email").innerText = data.Email;
    
    const assignContainer = document.getElementById("teacher-assignments-container");
    const classSelect = document.getElementById("dashboard-class-select");
    
    if (data.Assignments) {
        // Clear previous
        if (assignContainer) assignContainer.innerHTML = "";
        if (classSelect) {
            classSelect.innerHTML = '<option value="all" style="color: #0f172a;">All Classes</option>';
        }

        const uniqueClasses = new Map();
        
        data.Assignments.forEach(ass => {
            // Sidebar display
            if (assignContainer) {
                const div = document.createElement("div");
                div.innerText = `${ass.ClassName} - ${ass.SubjectName}`;
                assignContainer.appendChild(div);
            }

            // Collect unique classes for dropdown
            if (!uniqueClasses.has(ass.ClassID)) {
                uniqueClasses.set(ass.ClassID, {
                    name: ass.ClassName,
                    count: ass.StudentCount
                });
                
                if (classSelect) {
                    const opt = document.createElement("option");
                    opt.value = ass.ClassID;
                    opt.innerText = ass.ClassName;
                    opt.style.color = "#0f172a";
                    classSelect.appendChild(opt);
                }
            }
        });

        // Dropdown change listener
        classSelect?.addEventListener("change", (e) => {
            const val = e.target.value;
            const listContainer = document.getElementById("student-list-container");
            const countDisplay = document.getElementById("teacher-student-count");
            const classNameDisplay = document.getElementById("selected-class-name");

            if (val === "all") {
                countDisplay.innerText = data.StudentCount || 0;
                if (listContainer) listContainer.style.display = "none";
            } else {
                const cls = uniqueClasses.get(parseInt(val));
                countDisplay.innerText = cls ? cls.count : 0;
                if (classNameDisplay) classNameDisplay.innerText = cls ? cls.name : "";
                if (listContainer) listContainer.style.display = "block";
                loadClassStudents(val);
            }
        });
    }
    
    // Initial display
    const countDisplay = document.getElementById("teacher-student-count");
    if (countDisplay) countDisplay.innerText = data.StudentCount || 0;
    
    // Update Avatar Initial
    const avatar = document.querySelector(".user-avatar");
    if (avatar && data.FullName) {
        avatar.innerText = data.FullName.charAt(0).toUpperCase();
    }

  } catch (error) {
    console.error("Error fetching teacher profile:", error);
  }
}

async function loadClassStudents(classID) {
    const listBody = document.getElementById("dashboard-student-list");
    if (!listBody) return;
    
    listBody.innerHTML = '<tr><td colspan="2" style="padding: 20px; text-align: center; color: #64748b;">Loading students...</td></tr>';
    
    const token = localStorage.getItem("token");
    try {
        const response = await fetch(`/api/students/by-class/${classID}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (response.ok) {
            const students = await response.json();
            if (students.length === 0) {
                listBody.innerHTML = '<tr><td colspan="2" style="padding: 20px; text-align: center; color: #64748b;">No students found in this class.</td></tr>';
            } else {
                listBody.innerHTML = "";
                students.forEach(student => {
                    const tr = document.createElement("tr");
                    tr.style.borderBottom = "1px solid #f1f5f9";
                    tr.innerHTML = `
                        <td style="padding: 16px 24px; font-weight: 500; color: #0f172a;">${student.RollNo}</td>
                        <td style="padding: 16px 24px; color: #334155;">${student.FullName}</td>
                    `;
                    listBody.appendChild(tr);
                });
            }
        } else {
             listBody.innerHTML = '<tr><td colspan="2" style="padding: 20px; text-align: center; color: #ef4444;">Failed to load students.</td></tr>';
        }
    } catch (error) {
        console.error("Error loading students:", error);
        listBody.innerHTML = '<tr><td colspan="2" style="padding: 20px; text-align: center; color: #ef4444;">Error connecting to server.</td></tr>';
    }
}

