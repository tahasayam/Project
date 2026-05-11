document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    let studentProfile = null;

    // 1) Fetch Student Profile
    try {
        const response = await fetch('/api/students/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        studentProfile = await response.json();
        
        if (response.ok) {
            document.getElementById('welcome-message').textContent = `Welcome back, ${studentProfile.FullName} — Class ${studentProfile.ClassName}`;
            document.querySelector('.user-name').textContent = studentProfile.FullName;
            document.querySelector('.user-avatar').textContent = studentProfile.FullName.charAt(0);
            
            // Initial Data Load
            loadAttendance('latest');
        } else {
            alert('Session expired. Please login again.');
            window.location.href = '../login.html';
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
    }

    // 2) Attendance Logic
    const monthSelect = document.getElementById('month-select');
    monthSelect.addEventListener('change', (e) => {
        loadAttendance(e.target.value);
    });

    async function loadAttendance(month) {
        if (!studentProfile) return;

        const targetMonth = month === 'latest' ? new Date().getMonth() + 1 : month;
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        try {
            const response = await fetch(`/api/attendance/stats/${studentProfile.StudentID}/${targetMonth}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            document.getElementById('attendance-percent').textContent = `${data.percent}%`;
            document.getElementById('attendance-month-label').textContent = month === 'latest' ? 'Latest Month' : `${monthNames[targetMonth - 1]}`;
            
            const summary = document.getElementById('attendance-summary');
            if (data.totalDays > 0) {
                summary.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; padding: 20px;">
                        <div style="text-align: center; padding: 15px; background: #ecfdf5; border-radius: 12px;">
                            <p style="font-size: 12px; color: #059669; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Presents</p>
                            <h4 style="font-size: 24px; color: #065f46; font-weight: 700;">${data.presentDays}</h4>
                        </div>
                        <div style="text-align: center; padding: 15px; background: #fef2f2; border-radius: 12px;">
                            <p style="font-size: 12px; color: #dc2626; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Absents</p>
                            <h4 style="font-size: 24px; color: #991b1b; font-weight: 700;">${data.absentDays}</h4>
                        </div>
                        <div style="text-align: center; padding: 15px; background: #fffbeb; border-radius: 12px;">
                            <p style="font-size: 12px; color: #d97706; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Leaves</p>
                            <h4 style="font-size: 24px; color: #92400e; font-weight: 700;">${data.leaveDays}</h4>
                        </div>
                    </div>
                `;
            } else {
                summary.innerHTML = `
                    <div style="padding: 40px; text-align: center;">
                        <svg style="width: 48px; height: 48px; color: #cbd5e1; margin-bottom: 15px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        <p style="color: #64748b; font-weight: 500;">Record is not uploaded yet</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error fetching attendance:', error);
        }
    }

    // Logout
    document.querySelector('.sign-out').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = '../login.html';
    });
});