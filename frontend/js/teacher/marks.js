document.addEventListener('DOMContentLoaded', async function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    const saveBtn = document.querySelector('.save-draft-btn');
    const cancelBtn = document.querySelector('.cancel-btn');
    const classSelect = document.getElementById('class-select');
    const subjectSelect = document.getElementById('subject-select');
    const termSelect = document.getElementById('term-select'); // Assumes you add a term select in HTML, or we can hardcode for now
    const noSelectionMessage = document.getElementById('no-selection-message');
    const marksTableContainer = document.getElementById('marks-table-container');
    const marksTbody = document.getElementById('marks-tbody');
    const marksFooter = document.getElementById('marks-footer');

    let teacherProfile = null;
    let currentStudents = [];

    // Fetch Teacher Profile
    try {
        const response = await fetch('/api/teachers/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        teacherProfile = await response.json();
        
        if (response.ok) {
            const userNameEl = document.querySelector('.user-name');
            if(userNameEl) userNameEl.textContent = teacherProfile.FullName;

            // Populate Class
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
                }
            }

            // Function to populate Subjects based on selected Class
            function populateSubjects(classID) {
                if (subjectSelect) {
                    subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
                    if (teacherProfile.Assignments && classID) {
                        const classAssignments = teacherProfile.Assignments.filter(ass => ass.ClassID == classID);
                        classAssignments.forEach(ass => {
                            const opt = document.createElement('option');
                            opt.value = ass.SubjectName;
                            opt.textContent = ass.SubjectName;
                            subjectSelect.appendChild(opt);
                        });
                    }
                }
            }

            if (classSelect) {
                classSelect.addEventListener('change', function() {
                    populateSubjects(this.value);
                });
            }

        } else {
            alert('Session expired.');
            window.location.href = '../login.html';
        }
    } catch(err) {
        console.error('Error fetching profile:', err);
    }

    function attachInputListeners() {
        const markInputs = document.querySelectorAll('.mark-input');
        markInputs.forEach(input => {
            input.addEventListener('input', function() {
                this.style.borderColor = '#eaecf0';
            });
        });
    }

    async function checkSelection() {
        const term = termSelect ? termSelect.value : 'First';

        if (classSelect && subjectSelect && termSelect && classSelect.value && subjectSelect.value && termSelect.value) {
            if(noSelectionMessage) noSelectionMessage.style.display = 'none';
            if(marksTableContainer) marksTableContainer.style.display = 'block';
            if(marksFooter) marksFooter.style.display = 'flex';

            marksTbody.innerHTML = '<tr><td colspan="3">Loading students...</td></tr>';

            try {
                const res = await fetch(`/api/students/by-class/${classSelect.value}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                currentStudents = await res.json();

                if(currentStudents.length === 0) {
                    marksTbody.innerHTML = '<tr><td colspan="3" class="text-center text-red-500">No students found.</td></tr>';
                    saveBtn.style.display = 'none';
                    return;
                }

                saveBtn.style.display = 'block';
                let html = '';
                currentStudents.forEach(student => {
                    html += `
                        <tr data-id="${student.StudentID}">
                            <td class="roll-no">${student.RollNo}</td>
                            <td class="student-name">${student.FullName}</td>
                            <td class="text-right">
                                <input type="number" class="mark-input total-mark" placeholder="100" min="1" max="1000" value="100" style="width: 80px; text-align: center;">
                            </td>
                            <td class="text-right">
                                <input type="number" class="mark-input obtained-mark" placeholder="0" min="0" max="1000" style="width: 80px; text-align: center;">
                            </td>
                        </tr>
                    `;
                });
                marksTbody.innerHTML = html;
                attachInputListeners();
            } catch(err) {
                console.error(err);
                marksTbody.innerHTML = '<tr><td colspan="3">Error loading students.</td></tr>';
            }
        } else {
            if(noSelectionMessage) noSelectionMessage.style.display = 'block';
            if(marksTableContainer) marksTableContainer.style.display = 'none';
            if(marksFooter) marksFooter.style.display = 'none';
        }
    }

    if (classSelect) classSelect.addEventListener('change', checkSelection);
    if (subjectSelect) subjectSelect.addEventListener('change', checkSelection);
    if (termSelect) termSelect.addEventListener('change', checkSelection);

    if (saveBtn) {
        saveBtn.addEventListener('click', async function() {
            const rows = document.querySelectorAll('#marks-tbody tr');
            const term = document.getElementById('term-select')?.value || 'First';
            let hasError = false;
            
            const resultsToSave = [];

            rows.forEach(row => {
                const obtainedInput = row.querySelector('.obtained-mark');
                const totalInput = row.querySelector('.total-mark');
                const obtainedVal = parseFloat(obtainedInput.value);
                const totalVal = parseFloat(totalInput.value);
                const studentID = row.getAttribute('data-id');

                let rowError = false;
                if (isNaN(obtainedVal) || obtainedVal < 0 || obtainedVal > totalVal) {
                    rowError = true;
                    obtainedInput.style.borderColor = '#ef4444';
                } else {
                    obtainedInput.style.borderColor = '#eaecf0';
                }

                if (isNaN(totalVal) || totalVal <= 0) {
                    rowError = true;
                    totalInput.style.borderColor = '#ef4444';
                } else {
                    totalInput.style.borderColor = '#eaecf0';
                }

                if (rowError) {
                    hasError = true;
                } else {
                    resultsToSave.push({
                        studentID: studentID,
                        subjectName: subjectSelect.value,
                        term: term,
                        marksObtained: obtainedVal,
                        totalMarks: totalVal
                    });
                }
            });

            if (hasError) {
                alert('Please enter valid marks for all students. Obtained marks cannot be greater than Total marks, and Total marks must be greater than 0.');
                return;
            }

            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;

            try {
                // Submit each result
                for(const result of resultsToSave) {
                    await fetch('/api/results/add', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(result)
                    });
                }
                alert('Marks saved successfully!');
                location.href = 'index.html';
            } catch(e) {
                alert('Connection error while saving marks.');
            } finally {
                saveBtn.textContent = 'Save Marks';
                saveBtn.disabled = false;
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
                location.href = 'index.html';
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
