document.addEventListener('DOMContentLoaded', async function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    const classSelect = document.getElementById('class-select');
    const dateSelect = document.getElementById('date-select');
    const studentListContainer = document.getElementById('student-list-container');
    const noClassMessage = document.getElementById('no-class-message');
    const presentCountEl = document.getElementById('present-count');
    const submitBtn = document.querySelector('.submit-attendance-btn');
    
    // Set current date
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (dateSelect) {
        dateSelect.value = today;
    }

    let teacherProfile = null;
    let currentStudents = [];

    // 1. Fetch Teacher Profile to see assigned classes
    try {
        const response = await fetch('/api/teachers/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        teacherProfile = await response.json();
        
        if (response.ok) {
            // Update UI with teacher name if element exists
            const userNameEl = document.querySelector('.user-name');
            if(userNameEl) userNameEl.textContent = teacherProfile.FullName;
            
            // Populate class select
            if (classSelect) {
                classSelect.innerHTML = '<option value="">-- Select Class --</option>';
                const uniqueClasses = new Map();
                if (teacherProfile.Assignments && teacherProfile.Assignments.length > 0) {
                    teacherProfile.Assignments.forEach(ass => {
                        if (!uniqueClasses.has(ass.ClassID)) {
                            uniqueClasses.set(ass.ClassID, ass.ClassName);
                            const opt = document.createElement('option');
                            opt.value = ass.ClassID;
                            opt.textContent = ass.ClassName;
                            classSelect.appendChild(opt);
                        }
                    });
                } else {
                    noClassMessage.innerHTML = '<h2>You have not been assigned to any class.</h2>';
                }
            }
        } else {
            alert('Session expired.');
            window.location.href = '../login.html';
        }
    } catch(err) {
        console.error('Error fetching profile:', err);
    }

    function updateSummary() {
        const total = document.querySelectorAll('.attendance-item').length;
        const presentCount = document.querySelectorAll('input[type="radio"][value="Present"]:checked').length;
        if (presentCountEl && presentCountEl.parentNode) {
            presentCountEl.parentNode.innerHTML = `<span id="present-count">${presentCount}</span>/${total} Present`;
        }
    }

    function attachToggleListeners() {
        const radios = document.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => {
            radio.addEventListener('change', function() {
                updateSummary();
            });
        });
        updateSummary();
    }

    async function loadStudentsAndAttendance() {
        const classVal = classSelect ? classSelect.value : null;
        const dateVal = dateSelect ? dateSelect.value : null;
        
        if (classVal && dateVal) {
            noClassMessage.style.display = 'none';
            studentListContainer.style.display = 'block';
            submitBtn.style.display = 'block';
            studentListContainer.innerHTML = '<p>Loading students...</p>';

            try {
                // Fetch students AND their existing attendance for this date
                const res = await fetch(`/api/attendance/view-student/${classVal}/${dateVal}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                currentStudents = await res.json();

                if(currentStudents.length === 0) {
                    studentListContainer.innerHTML = '<p>No students found in this class.</p>';
                    submitBtn.style.display = 'none';
                    return;
                }

                let html = '';
                currentStudents.forEach(student => {
                    const status = student.Status || 'Present'; // Default to Present if not marked
                    html += `
                        <div class="attendance-item" data-id="${student.StudentID}">
                            <span class="student-id">${student.RollNo}</span>
                            <span class="student-name">${student.FullName}</span>
                            <div class="attendance-actions" style="display:flex; gap:15px; align-items:center;">
                                <label style="cursor:pointer; display:flex; align-items:center; gap:5px; color:#10b981; font-weight:500;">
                                    <input type="radio" name="status-${student.StudentID}" value="Present" ${status === 'Present' ? 'checked' : ''} style="accent-color:#10b981; transform:scale(1.2);"> Present
                                </label>
                                <label style="cursor:pointer; display:flex; align-items:center; gap:5px; color:#ef4444; font-weight:500;">
                                    <input type="radio" name="status-${student.StudentID}" value="Absent" ${status === 'Absent' ? 'checked' : ''} style="accent-color:#ef4444; transform:scale(1.2);"> Absent
                                </label>
                                <label style="cursor:pointer; display:flex; align-items:center; gap:5px; color:#f59e0b; font-weight:500;">
                                    <input type="radio" name="status-${student.StudentID}" value="Leave" ${status === 'Leave' ? 'checked' : ''} style="accent-color:#f59e0b; transform:scale(1.2);"> Leave
                                </label>
                            </div>
                        </div>
                    `;
                });
                studentListContainer.innerHTML = html;
                attachToggleListeners();
            } catch(err) {
                console.error('Error fetching students:', err);
                studentListContainer.innerHTML = '<p style="color:red;">Error loading students.</p>';
            }
            
        } else {
            noClassMessage.style.display = 'block';
            studentListContainer.style.display = 'none';
            submitBtn.style.display = 'none';
            if(presentCountEl && presentCountEl.parentNode) {
                presentCountEl.parentNode.innerHTML = `<span id="present-count">0</span>/0 Present`;
            }
        }
    }

    if (classSelect) {
        classSelect.addEventListener('change', loadStudentsAndAttendance);
    }
    
    if (dateSelect) {
        dateSelect.addEventListener('change', loadStudentsAndAttendance);
    }

    // Handle Submit Bulk Attendance
    if (submitBtn) {
        submitBtn.style.display = 'none';
        submitBtn.addEventListener('click', async function() {
            if (!classSelect || !classSelect.value) {
                alert('Please select a class first.');
                return;
            }

            const items = document.querySelectorAll('.attendance-item');
            const records = [];
            items.forEach(item => {
                const studentID = item.getAttribute('data-id');
                const selectedRadio = item.querySelector(`input[name="status-${studentID}"]:checked`);
                const status = selectedRadio ? selectedRadio.value : 'Present';
                records.push({
                    targetID: parseInt(studentID),
                    status: status
                });
            });

            submitBtn.textContent = 'Saving...';
            submitBtn.disabled = true;

            try {
                const res = await fetch('/api/attendance/mark', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        date: dateSelect.value,
                        targetType: 'Student',
                        records: records
                    })
                });

                if(res.ok) {
                    alert('Attendance submitted successfully!');
                    location.href = 'index.html';
                } else {
                    const err = await res.json();
                    alert(err.message || 'Error saving attendance');
                    submitBtn.textContent = 'Submit Attendance';
                    submitBtn.disabled = false;
                }
            } catch(e) {
                alert('Connection error');
                submitBtn.textContent = 'Submit Attendance';
                submitBtn.disabled = false;
            }
        });
    }

    // Logout
    document.querySelector('.sign-out')?.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = '../login.html';
    });
});
