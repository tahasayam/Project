let publishedResult = {
  class: null,
  term: null
};
let resultsMode = ""; // "publish" or "view"
let lastFetchedClasses = [];

document.addEventListener("DOMContentLoaded", async () => {
  // Check for token
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "../login.html";
    return;
  }

  // Update User Info
  const username = localStorage.getItem("username");
  if (username) {
    const nameEl = document.querySelector(".user-name");
    const avatarEl = document.querySelector(".user-avatar");
    if (nameEl) nameEl.innerText = username;
    if (avatarEl) avatarEl.innerText = username.charAt(0).toUpperCase();
  }

  // Fetch Dashboard Stats & Teachers
  fetchStats();
  fetchTeachers();

  // Global listeners for result term dependencies
  document.getElementById("publish-class")?.addEventListener("change", (e) => loadAvailableTerms(e.target.value, "publish-term"));
  document.getElementById("vr-class")?.addEventListener("change", (e) => loadAvailableTerms(e.target.value, "vr-term"));

  // Teacher Password Toggle
  document.getElementById("toggle-teacher-pass")?.addEventListener("click", () => {
    const passInput = document.getElementById("add-teacher-password");
    const toggleIcon = document.getElementById("toggle-teacher-pass");
    if (passInput && toggleIcon) {
      if (passInput.type === "password") {
        passInput.type = "text";
        toggleIcon.innerText = "🔒";
      } else {
        passInput.type = "password";
        toggleIcon.innerText = "👁️";
      }
    }
  });

  // Student Password Toggle
  document.getElementById("toggle-student-pass")?.addEventListener("click", () => {
    const passInput = document.getElementById("add-student-password");
    const toggleIcon = document.getElementById("toggle-student-pass");
    if (passInput && toggleIcon) {
      if (passInput.type === "password") {
        passInput.type = "text";
        toggleIcon.innerText = "🔒";
      } else {
        passInput.type = "password";
        toggleIcon.innerText = "👁️";
      }
    }
  });

  // --- ROBUST NAVIGATION LOGIC ---
  const navItems = document.querySelectorAll(".nav-item");
  const pages = document.querySelectorAll(".page");
  const pageTitle = document.getElementById("pageTitle");

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const target = item.getAttribute("data-page");
      if (!target) return;

      console.log("Navigating to:", target);

      // Update Active Nav
      navItems.forEach((i) => i.classList.remove("active"));
      item.classList.add("active");

      // Update Active Page
      pages.forEach((p) => p.classList.remove("active"));
      const activePage = document.getElementById("page-" + target);
      if (activePage) {
        activePage.classList.add("active");
        if (pageTitle) pageTitle.innerText = item.innerText.trim();
      } else {
        console.warn("Target page not found:", "page-" + target);
      }
    });
  });
});

async function fetchStats() {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch("/api/admin/stats", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Stats fetch failed");
    const stats = await res.json();

    // Update UI
    const statValues = document.querySelectorAll(".stat-value");
    if (statValues.length >= 3) {
      statValues[0].innerText = stats.totalStudents || 0;
      statValues[1].innerText = stats.totalTeachers || 0;
      statValues[2].innerText = stats.totalClasses || 0;
      if (statValues[3]) statValues[3].innerText = "0%"; // Placeholder for attendance
    }
  } catch (error) {
    console.error("Error fetching stats:", error);
  }
}

async function fetchTeachers() {
  const token = localStorage.getItem("token");
  const listBody = document.getElementById("admin-teacher-list-body");
  if (!listBody) return;

  try {
    const res = await fetch("/api/teachers/all", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Teachers fetch failed");
    const teachers = await res.json();
    
    listBody.innerHTML = "";
    teachers.forEach(t => {
      const row = document.createElement("tr");
      row.style.borderBottom = "1px solid #f1f5f9";
      row.innerHTML = `
        <td style="padding: 15px; text-align: left; font-weight: 600; color: #1e293b;">${t.FullName}</td>
        <td style="padding: 15px; text-align: left; color: #475569;">${t.Subject || '-'}</td>
        <td style="padding: 15px; text-align: left; color: #475569;">${t.AssignedClasses || '-'}</td>
        <td style="padding: 15px; text-align: center;">
          <button class="btn-primary" data-id="${t.TeacherID}" data-name="${t.FullName}" style="padding: 6px 12px; font-size: 11px; background: #6366f1;">Manage</button>
        </td>
      `;
      // Use addEventListener instead of inline onclick for safety
      row.querySelector('button').addEventListener('click', () => {
          openManageAssignmentsModal(t.TeacherID, t.FullName);
      });
      listBody.appendChild(row);
    });
  } catch (err) {
    console.error("Error fetching teachers:", err);
  }
}

// Logout Logic
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "../login.html";
});

// ── MODALS ───────────────────────────────────────
async function openModal(name) {
  const modal = document.getElementById(`modal-${name}`);
  if (!modal) return;

  // Specific Logic for "Create Class"
  if (name === "create-class") {
    await fetchAvailableTeachers();
  }

  if (name === "add-student" || name === "delete-student" || name === "mark-attendance" || name === "publish-result" || name === "view-result" || name === "add-teacher" || name === "assign-teacher") {
    await fetchAllClasses(name);
  }

  if (name === "assign-teacher") {
    await populateQuickAssignTeachers();
  }

  modal.classList.add("show");
}

async function fetchAvailableTeachers() {
  const token = localStorage.getItem("token");
  const select = document.querySelector("#modal-create-class select");
  if (!select) return;

  try {
    const response = await fetch("/api/classes/available-teachers", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const teachers = await response.json();

    select.innerHTML = '<option value="">-- No Teacher Assigned --</option>';
    teachers.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.TeacherID;
      opt.innerText = t.FullName;
      select.appendChild(opt);
    });
  } catch (error) {
    console.error("Error fetching teachers:", error);
  }
}

// --- Global State ---

async function fetchAllClasses(modalName) {
  const token = localStorage.getItem("token");
  let select = document.querySelector(`#modal-${modalName} select`);
  
  if (modalName === "assign-teacher") {
    select = document.getElementById("quick-assign-class-select");
  } else if (modalName === "manage-assignments") {
    select = document.getElementById("manage-assign-class-select");
  } else if (modalName === "mark-attendance") {
    select = document.getElementById("ma-class");
  }

  try {
    const response = await fetch("/api/classes/all", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const classes = await response.json();
    lastFetchedClasses = classes;

    if (select) {
      select.innerHTML = '<option value="">-- Select Class --</option>';
      classes.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.ClassID;
        opt.innerText = c.ClassName;
        select.appendChild(opt);
      });
    }
  } catch (error) {
    console.error("Error fetching classes:", error);
  }
}

async function loadAvailableTerms(classID, termSelectID) {
  const termSelect = document.getElementById(termSelectID);
  if (!termSelect) return;

  if (!classID) {
    termSelect.innerHTML = '<option value="">-- Select Class First --</option>';
    return;
  }

  const token = localStorage.getItem("token");
  try {
    const response = await fetch(`/api/results/available-terms/${classID}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const terms = await response.json();

    if (terms.length === 0) {
      termSelect.innerHTML = '<option value="">No results uploaded yet</option>';
    } else {
      termSelect.innerHTML = '<option value="">-- Select Term --</option>';
      terms.forEach(term => {
        const opt = document.createElement("option");
        opt.value = term;
        opt.innerText = term;
        termSelect.appendChild(opt);
      });
    }
  } catch (error) {
    console.error("Error fetching terms:", error);
    termSelect.innerHTML = '<option value="">Error loading terms</option>';
  }
}

function closeModal(name) {
  const modal = document.getElementById(`modal-${name}`);
  if (modal) modal.classList.remove("show");
}

// close modal on outside click
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", function (e) {
    if (e.target === this) this.classList.remove("show");
  });
});


// ── TOAST ───────────────────────────────────────
let toastTimer;

function showToast(icon, msg) {
  const toast = document.getElementById("toast");
  const toastIcon = document.getElementById("toastIcon");
  const toastMsg = document.getElementById("toastMsg");

  if (!toast || !toastIcon || !toastMsg) return;

  toastIcon.textContent = icon;
  toastMsg.textContent = msg;

  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}


// ── FORM HANDLER (API INTEGRATED) ───────────────────────────────
async function submitForm(modalName, successMsg) {
  const modal = document.getElementById(`modal-${modalName}`);
  if (!modal) return;

  const token = localStorage.getItem("token");
  let endpoint = "";
  let payload = {};

  if (modalName === "add-student") {
    endpoint = "/api/students/add";
    const classSelect = document.getElementById("add-student-class");
    
    // Extract className from the dropdown text
    const fullClassName = classSelect.options[classSelect.selectedIndex]?.text || '';
    
    // Parse "Class 1A" or "8-A" into ClassName="8" and Section="A"
    const numberMatch = fullClassName.match(/\d+/);
    const parsedClass = numberMatch ? numberMatch[0] : "";
    // Match the last single letter as the section
    const sectionMatch = fullClassName.match(/([A-Z])(?=\s*$)/i);
    const parsedSection = sectionMatch ? sectionMatch[1].toUpperCase() : "";

    payload = {
      fullName: document.getElementById("add-student-name").value,
      rollNo: document.getElementById("add-student-roll").value,
      dob: document.getElementById("add-student-dob").value,
      guardianName: document.getElementById("add-student-guardian").value,
      email: document.getElementById("add-student-email").value,
      password: document.getElementById("add-student-password").value,
      classID: classSelect.value,
      className: parsedClass,
      section: parsedSection
    };
  } else if (modalName === "delete-student") {
    const allInputs = modal.querySelectorAll("input");
    const rollNo = allInputs[0].value;
    endpoint = `/api/students/delete/${encodeURIComponent(rollNo)}`;
  } else if (modalName === "add-teacher") {
    endpoint = "/api/teachers/add";
    const allInputs = modal.querySelectorAll("input");

    payload = {
      fullName: allInputs[0].value,
      email: allInputs[1].value,
      phoneNo: allInputs[2].value,
      password: document.getElementById("add-teacher-password").value,
      assignments: currentAssignments // Global array
    };
    currentAssignments = []; // Reset after use
    document.getElementById("teacher-assignments-list").innerHTML = "";
  } else if (modalName === "delete-teacher") {
    const allInputs = modal.querySelectorAll("input");
    const phoneNo = allInputs[0].value;
    endpoint = `/api/teachers/delete/${encodeURIComponent(phoneNo)}`;
  } else if (modalName === "create-class") {
    endpoint = "/api/classes/add";
    const allInputs = modal.querySelectorAll("input");
    const subjectList = document.getElementById("class-subjects-input").value
      .split(",")
      .map(s => s.trim())
      .filter(s => s !== "");

    payload = {
      className: allInputs[0].value,
      maxStudents: allInputs[1].value,
      subjects: subjectList
    };
  }

  if (endpoint) {
    try {
      const isDelete = modalName.startsWith('delete');
      const fetchOptions = {
        method: isDelete ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      };
      
      if (!isDelete) {
        fetchOptions.body = JSON.stringify(payload);
      }

      const response = await fetch(endpoint, fetchOptions);

      if (response.ok) {
        const data = await response.json();
        closeModal(modalName);
        showToast("✅", data.message || successMsg);
        lastFetchedClasses = []; // Reset cache to pick up new changes
        fetchStats(); // Refresh counts
        if (modalName === "create-class") location.reload(); // Hard reload for class list
      } else {
        const errData = await response.json();
        showToast("❌", errData.message || "Failed to save data");
      }
    } catch (error) {
      showToast("❌", "Connection to server failed");
    }
  } else {
    closeModal(modalName);
    showToast("✅", successMsg);
  }
}

// ───────── RESULT PUBLISH (CLEAN) ─────────
async function publishResults() {
  const classEl = document.getElementById("publish-class");
  const termEl = document.getElementById("publish-term");
  const token = localStorage.getItem("token");

  if (!classEl || !termEl) return;

  try {
    const res = await fetch("/api/results/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        classID: classEl.value,
        term: termEl.value
      })
    });

    if (res.ok) {
      closeModal("publish-result");
      showToast("⭐", `Result published successfully!`);
    } else {
      const err = await res.json();
      showToast("❌", err.message || "Failed to publish result.");
    }
  } catch (error) {
    showToast("❌", "Connection failed");
  }
}

// ───────── VIEW RESULT (CLEAN) ─────────
async function checkResult() {
  const classEl = document.getElementById("vr-class");
  const termEl = document.getElementById("vr-term");
  const token = localStorage.getItem("token");

  if (!classEl || !termEl || !classEl.value) {
    showToast("⚠️", "Please select class and term");
    return;
  }

  try {
    const res = await fetch(`/api/results/class/${classEl.value}/${termEl.value}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      
      document.getElementById("check-result-form").style.display = "none";
      document.getElementById("res-exam").innerText = classEl.options[classEl.selectedIndex].text + " - " + termEl.options[termEl.selectedIndex].text;
      
      renderResultsTable(data, true); // showStatus = true
      
      document.getElementById("result-display").style.display = "block";
      showToast("📊", "Result loaded successfully");
    } else {
      showToast("❌", "Error loading results");
    }
  } catch (error) {
    showToast("❌", "Connection failed");
  }
}

function renderResultsTable(data, showStatus) {
  const tbody = document.querySelector("#results-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:15px;'>No results found for this class/term.</td></tr>";
    return;
  }

  data.forEach(r => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #f1f5f9";
    
    const marks = r.MarksObtained != null ? `${r.MarksObtained} / ${r.TotalMarks}` : "<em style='color:#94a3b8'>Not Marked</em>";
    let statusHtml = "";
    
    if (showStatus) {
      if (r.MarksObtained == null) {
        statusHtml = "—";
      } else {
        statusHtml = r.IsPublished 
          ? "<span style='color:#10b981; font-weight:700;'>✅ Approved</span>" 
          : "<span style='color:#f59e0b; font-weight:700;'>⏳ Pending</span>";
      }
    } else {
      statusHtml = "<span style='color:#64748b'>Hidden</span>";
    }

    tr.innerHTML = `
      <td style="padding:10px 5px;">${r.RollNo}</td>
      <td style="padding:10px 5px; font-weight:600;">${r.FullName}</td>
      <td style="padding:10px 5px;">${r.SubjectName || "—"}</td>
      <td style="padding:10px 5px; text-align:center;">${marks}</td>
      <td style="padding:10px 5px; text-align:center;">${statusHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ───────── INLINE RESULTS PANEL ─────────
async function toggleResultsPanel(mode) {
  resultsMode = mode;
  const panel = document.getElementById("results-selection-panel");
  const title = document.getElementById("panel-title");
  const btn = document.getElementById("res-panel-btn");

  if (!panel || !title || !btn) return;

  panel.style.display = "block";

  if (mode === "publish") {
    title.innerText = "⭐ Publish Exam Results";
    btn.innerText = "Publish Now";
    btn.style.backgroundColor = "#00b894";
  } else {
    title.innerText = "🔍 View Student Results";
    btn.innerText = "View Results";
    btn.style.backgroundColor = "#6366f1";
  }

  // Populate classes for this inline panel
  const select = document.getElementById("res-select-class");
  if (select) {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch("/api/classes/all", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const classes = await response.json();
      select.innerHTML = '<option value="">-- Select Class --</option>';
      classes.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.ClassID;
        opt.innerText = c.ClassName;
        select.appendChild(opt);
      });

      // Add listener for inline panel
      select.removeEventListener("change", handleInlineClassChange);
      select.addEventListener("change", handleInlineClassChange);

    } catch (e) {
      console.error("Error fetching classes for panel", e);
    }
  }

  panel.scrollIntoView({ behavior: 'smooth' });
}

function handleInlineClassChange(e) {
  loadAvailableTerms(e.target.value, "res-select-term");
}

async function executeResultAction() {
  const classVal = document.getElementById("res-select-class").value;
  const termVal = document.getElementById("res-select-term").value;
  const classText = document.getElementById("res-select-class").options[document.getElementById("res-select-class").selectedIndex].text;
  const termText = document.getElementById("res-select-term").options[document.getElementById("res-select-term").selectedIndex].text;
  const token = localStorage.getItem("token");

  if (!classVal || !termVal) {
    showToast("⚠️", "Please select class and term");
    return;
  }

  if (resultsMode === "publish") {
    try {
      // First, fetch and show results WITHOUT status (as requested)
      const resData = await fetch(`/api/results/class/${classVal}/${termVal}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await resData.json();

      openModal('view-result');
      document.getElementById("check-result-form").style.display = "none";
      document.getElementById("res-exam").innerText = classText + " - " + termText;
      renderResultsTable(data, false); // showStatus = false
      document.getElementById("result-display").style.display = "block";
      
      // Update the proceed button in the panel to actually publish
      const btn = document.getElementById("res-panel-btn");
      btn.innerText = "Confirm Publish";
      btn.onclick = async () => {
        const publishRes = await fetch("/api/results/publish", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ classID: classVal, term: termVal })
        });
        if (publishRes.ok) {
          showToast("⭐", `Result published!`);
          document.getElementById("results-selection-panel").style.display = "none";
          closeModal('view-result');
          // Reset button
          btn.innerText = "Publish Now";
          btn.onclick = executeResultAction;
        } else {
          showToast("❌", "Failed to publish result");
        }
      };
      
    } catch(err) {
      showToast("❌", "Connection error");
    }
  } else {
    // View Results
    try {
      const res = await fetch(`/api/results/class/${classVal}/${termVal}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        openModal('view-result');
        document.getElementById("check-result-form").style.display = "none";
        document.getElementById("res-exam").innerText = classText + " - " + termText;
        renderResultsTable(data, true); // showStatus = true (shows approved status)
        document.getElementById("result-display").style.display = "block";
        showToast("📊", "Result loaded successfully");
        document.getElementById("results-selection-panel").style.display = "none";
      } else {
        showToast("❌", "Failed to load results");
      }
    } catch(err) {
      showToast("❌", "Connection error");
    }
  }
}

// ── ATTENDANCE ───────────────────────────────
async function loadAttendanceRoster() {
  const dateVal = document.getElementById("ma-date")?.value;
  const classID = document.getElementById("ma-class")?.value;
  const token = localStorage.getItem("token");

  if (!dateVal || !classID) {
    showToast("⚠️", "Please select both date and class");
    return;
  }

  try {
    const response = await fetch(`/api/attendance/view-student/${classID}/${dateVal}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      const tbody = document.querySelector("#ma-roster tbody");
      tbody.innerHTML = "";

      if (data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='3' style='text-align:center; padding:20px;'>No students found in this class.</td></tr>";
      } else {
        data.forEach(s => {
          const status = s.Status || "Present"; // Default to Present if not marked
          const tr = document.createElement("tr");
          tr.style.borderBottom = "1px solid #f1f5f9";
          tr.innerHTML = `
            <td style="padding:12px 0;">${s.RollNo}</td>
            <td style="padding:12px 0; font-weight:600; color:#0f172a;" class="student-name" data-id="${s.StudentID}">${s.FullName}</td>
            <td style="padding:12px 0; text-align:center; white-space:nowrap;">
              <label style="margin:0 5px; cursor:pointer;"><input type="radio" name="att-${s.StudentID}" value="Present" ${status === 'Present' ? 'checked' : ''}> P</label>
              <label style="margin:0 5px; cursor:pointer;"><input type="radio" name="att-${s.StudentID}" value="Absent" ${status === 'Absent' ? 'checked' : ''}> A</label>
              <label style="margin:0 5px; cursor:pointer;"><input type="radio" name="att-${s.StudentID}" value="Late" ${status === 'Late' ? 'checked' : ''}> L</label>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
      document.getElementById("ma-roster").style.display = "block";
    } else {
      showToast("❌", "Failed to load student roster");
    }
  } catch (error) {
    showToast("❌", "Connection failed");
  }
}

async function submitAttendance() {
  const dateVal = document.getElementById("ma-date")?.value;
  const token = localStorage.getItem("token");

  if (!dateVal) {
    showToast("⚠️", "Date is required");
    return;
  }

  const tbody = document.querySelector("#ma-roster tbody");
  const rows = tbody.querySelectorAll("tr");
  const records = [];

  rows.forEach(row => {
    const nameTd = row.querySelector(".student-name");
    if (nameTd) {
      const studentID = nameTd.getAttribute("data-id");
      const checkedRadio = row.querySelector(`input[name="att-${studentID}"]:checked`);
      if (studentID && checkedRadio) {
        records.push({
          targetID: parseInt(studentID),
          status: checkedRadio.value
        });
      }
    }
  });

  if (records.length === 0) {
    showToast("⚠️", "No records to save.");
    return;
  }

  try {
    const res = await fetch("/api/attendance/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        date: dateVal,
        targetType: "Student",
        records: records
      })
    });

    if (res.ok) {
      closeModal("mark-attendance");
      showToast("✅", "Student attendance saved successfully!");
    } else {
      showToast("❌", "Failed to save attendance.");
    }
  } catch (error) {
    showToast("❌", "Connection error");
  }
}

async function loadTeacherRoster() {
  const roster = document.getElementById("ta-roster");
  const tbody = roster.querySelector("tbody");
  const token = localStorage.getItem("token");

  if (!tbody) return;

  try {
    const response = await fetch("/api/teachers/all", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.ok) {
      const teachers = await response.json();
      tbody.innerHTML = "";
      
      if (teachers.length === 0) {
        tbody.innerHTML = "<tr><td colspan='3' style='text-align:center; padding:15px;'>No teachers found in database.</td></tr>";
      } else {
        teachers.forEach(t => {
          const tr = document.createElement("tr");
          tr.style.borderBottom = "1px solid #f1f5f9";
          tr.innerHTML = `
            <td style="padding:12px 0;">${t.TeacherID}</td>
            <td style="padding:12px 0; font-weight:600; color:#0f172a;" class="teacher-name" data-id="${t.TeacherID}">${t.FullName}</td>
            <td style="padding:12px 0; text-align:center; white-space:nowrap;">
              <label style="margin:0 5px; cursor:pointer;"><input type="radio" name="tatt-${t.TeacherID}" value="Present" checked> P</label>
              <label style="margin:0 5px; cursor:pointer;"><input type="radio" name="tatt-${t.TeacherID}" value="Absent"> A</label>
              <label style="margin:0 5px; cursor:pointer;"><input type="radio" name="tatt-${t.TeacherID}" value="Late"> L</label>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
      roster.style.display = "block";
    } else {
      showToast("❌", "Failed to load teachers");
    }
  } catch (error) {
    showToast("❌", "Connection failed");
  }
}

async function submitTeacherAttendance() {
  const dateVal = document.getElementById("ta-date")?.value;
  const token = localStorage.getItem("token");

  if(!dateVal) {
    showToast("⚠️", "Date is required");
    return;
  }

  const tbody = document.querySelector("#ta-roster tbody");
  const rows = tbody.querySelectorAll("tr");
  const records = [];

  rows.forEach(row => {
    const nameTd = row.querySelector(".teacher-name");
    if (nameTd) {
      const teacherID = nameTd.getAttribute("data-id");
      const checkedRadio = row.querySelector(`input[name="tatt-${teacherID}"]:checked`);
      if (teacherID && checkedRadio) {
        records.push({
          targetID: parseInt(teacherID),
          status: checkedRadio.value
        });
      }
    }
  });

  if (records.length === 0) {
    showToast("⚠️", "No teachers to mark.");
    return;
  }

  try {
    const res = await fetch("/api/attendance/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        date: dateVal,
        targetType: "Teacher",
        records: records
      })
    });
    
    if(res.ok) {
      closeModal("teacher-attendance");
      showToast("✅", "Teacher attendance saved successfully!");
      document.getElementById("ta-roster").style.display = "none";
    } else {
      showToast("❌", "Failed to mark attendance.");
    }
  } catch(e) {
    showToast("❌", "Connection error");
  }
}


// --- Multi-Assignment Helpers ---
let currentAssignments = [];

async function loadClassSubjectsForAssign(classID) {
  const subSelect = document.getElementById("assign-subject-select");
  if (!subSelect) return;
  
  if (!classID) {
      subSelect.innerHTML = '<option value="">-- Select Subject --</option>';
      return;
  }

  subSelect.innerHTML = '<option value="">⏳ Loading subjects...</option>';

  // Use cached classes if available, otherwise fetch
  let classes = lastFetchedClasses;
  if (classes.length === 0) {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/classes/all`, {
          headers: { "Authorization": `Bearer ${token}` }
      });
      classes = await response.json();
      lastFetchedClasses = classes;
  }

  const cls = classes.find(c => c.ClassID == classID);
  
  if (cls && cls.SubjectAssignments) {
      let subjects;
      try {
          subjects = (typeof cls.SubjectAssignments === 'string') 
              ? JSON.parse(cls.SubjectAssignments) 
              : cls.SubjectAssignments;
      } catch (e) {
          console.error("Failed to parse SubjectAssignments:", e);
          subjects = [];
      }

      if (subjects && Array.isArray(subjects) && subjects.length > 0) {
          subSelect.innerHTML = '<option value="">-- Select Subject --</option>';
          if (subjects.length > 1) {
              const allOpt = document.createElement("option");
              allOpt.value = "ALL";
              allOpt.innerText = "⭐ Select All Subjects";
              subSelect.appendChild(allOpt);
          }
          subjects.forEach(s => {
              const opt = document.createElement("option");
              opt.value = s.SubjectID;
              opt.innerText = s.SubjectName;
              subSelect.appendChild(opt);
          });
      }
  }
}
window.loadClassSubjectsForAssign = loadClassSubjectsForAssign;

function addAssignmentToList() {
  const classSelect = document.getElementById("assign-class-select");
  const subSelect = document.getElementById("assign-subject-select");
  const list = document.getElementById("teacher-assignments-list");

  if (!classSelect.value || !subSelect.value) return;

  const classID = classSelect.value;
  const className = classSelect.options[classSelect.selectedIndex].text;

  if (subSelect.value === "ALL") {
    for (let i = 2; i < subSelect.options.length; i++) {
      const sid = subSelect.options[i].value;
      const sname = subSelect.options[i].text;
      addSingleAssignment(classID, className, sid, sname, list);
    }
  } else {
    const subjectID = subSelect.value;
    const subjectName = subSelect.options[subSelect.selectedIndex].text;
    addSingleAssignment(classID, className, subjectID, subjectName, list);
  }
}
window.addAssignmentToList = addAssignmentToList;

let currentManagingTeacherID = null;

async function openManageAssignmentsModal(teacherID, teacherName) {
  currentManagingTeacherID = teacherID;
  currentAssignments = [];
  document.getElementById("manage-assignments-list").innerHTML = "";
  openModal("manage-assignments");

  // Fetch current assignments for this teacher
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`/api/teachers/all`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Fetch all classes to populate the dropdowns
    await fetchAllClasses("manage-assignments");

    // Trigger subject load for first class if needed
    const mc = document.getElementById("manage-assign-class-select");
    if (mc && mc.value) loadClassSubjectsForManage(mc.value);
  } catch (err) {
    console.error(err);
  }
}
window.openManageAssignmentsModal = openManageAssignmentsModal;

async function loadClassSubjectsForManage(classID) {
  const subSelect = document.getElementById("manage-assign-subject-select");
  if (!subSelect) return;

  let classes = lastFetchedClasses;
  const cls = classes.find((c) => c.ClassID == classID);
  subSelect.innerHTML = '<option value="">-- Select Subject --</option>';

  if (cls && cls.SubjectAssignments) {
    const subjects =
      typeof cls.SubjectAssignments === "string"
        ? JSON.parse(cls.SubjectAssignments)
        : cls.SubjectAssignments;
    subjects.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.SubjectID;
      opt.innerText = s.SubjectName;
      subSelect.appendChild(opt);
    });
  }
}
window.loadClassSubjectsForManage = loadClassSubjectsForManage;

function addAssignmentToManageList() {
  const classSelect = document.getElementById("manage-assign-class-select");
  const subSelect = document.getElementById("manage-assign-subject-select");
  const list = document.getElementById("manage-assignments-list");
  if (!classSelect.value || !subSelect.value) return;
  addSingleAssignment(
    classSelect.value,
    classSelect.options[classSelect.selectedIndex].text,
    subSelect.value,
    subSelect.options[subSelect.selectedIndex].text,
    list
  );
}
window.addAssignmentToManageList = addAssignmentToManageList;

async function saveTeacherAssignments() {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(
      "/api/teachers/update-assignments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teacherID: currentManagingTeacherID,
          assignments: currentAssignments,
        }),
      }
    );
    if (res.ok) {
      closeModal("manage-assignments");
      showToast("✅", "Assignments updated!");
      fetchTeachers(); // Refresh list
    }
  } catch (err) {
    showToast("❌", "Failed to update assignments");
  }
}
window.saveTeacherAssignments = saveTeacherAssignments;

function addSingleAssignment(classID, className, subjectID, subjectName, list) {
  if (
    currentAssignments.find((a) => a.classID == classID && a.subjectID == subjectID)
  )
    return;
  currentAssignments.push({ classID, subjectID });

  const tag = document.createElement("div");
  tag.style =
    "display: inline-flex; align-items: center; background: #00b894; color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; margin: 3px;";
  tag.innerHTML = `<span>${className} - ${subjectName}</span> <span style="margin-left: 8px; cursor: pointer;" onclick="this.parentElement.remove(); currentAssignments = currentAssignments.filter(a => a.classID != ${classID} || a.subjectID != ${subjectID});">✕</span>`;
  list.appendChild(tag);
}

// --- Quick Assign Helpers ---
async function populateQuickAssignTeachers() {
    const select = document.getElementById("quick-assign-teacher-select");
    if (!select) return;

    const token = localStorage.getItem("token");
    try {
        const res = await fetch("/api/teachers/all", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const teachers = await res.json();
        select.innerHTML = '<option value="">-- Select Teacher --</option>';
        teachers.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.TeacherID;
            opt.innerText = t.FullName;
            select.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

async function loadClassSubjectsForQuick(classID) {
    const subSelect = document.getElementById("quick-assign-subject-select");
    if (!subSelect) return;

    let classes = lastFetchedClasses;
    const cls = classes.find(c => c.ClassID == classID);
    subSelect.innerHTML = '<option value="">-- Select Subject --</option>';

    if (cls && cls.SubjectAssignments) {
        const subjects = typeof cls.SubjectAssignments === 'string' ? JSON.parse(cls.SubjectAssignments) : cls.SubjectAssignments;
        subjects.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.SubjectID;
            opt.innerText = s.SubjectName;
            subSelect.appendChild(opt);
        });
    }
}
window.loadClassSubjectsForQuick = loadClassSubjectsForQuick;

async function submitQuickAssignment() {
    const teacherID = document.getElementById("quick-assign-teacher-select").value;
    const classID = document.getElementById("quick-assign-class-select").value;
    const subjectID = document.getElementById("quick-assign-subject-select").value;
    const token = localStorage.getItem("token");

    if (!teacherID || !classID || !subjectID) {
        showToast("⚠️", "Please select teacher, class, and subject");
        return;
    }

    try {
        const res = await fetch("/api/teachers/update-assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                teacherID: teacherID,
                assignments: [{ classID: classID, subjectID: subjectID }],
                append: true 
            })
        });

        if (res.ok) {
            closeModal("assign-teacher");
            showToast("✅", "Assignment added successfully!");
            fetchTeachers();
        } else {
            showToast("❌", "Failed to assign teacher");
        }
    } catch (e) {
        showToast("❌", "Connection error");
    }
}
window.submitQuickAssignment = submitQuickAssignment;