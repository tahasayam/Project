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
            document.querySelector('.user-name').textContent = studentProfile.FullName;
            document.querySelector('.user-avatar').textContent = studentProfile.FullName.charAt(0);
        } else {
            alert('Session expired. Please login again.');
            window.location.href = '../login.html';
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
    }

    // 2) Results Logic
    const viewResultsBtn = document.getElementById('view-results-btn');
    const resultsContainer = document.getElementById('results-container');

    viewResultsBtn.addEventListener('click', async () => {
        if (resultsContainer.style.display === 'flex') {
            resultsContainer.style.display = 'none';
            viewResultsBtn.textContent = 'View Published Results';
            return;
        }

        resultsContainer.style.display = 'flex';
        resultsContainer.innerHTML = '<p style="font-size: 14px; color: #64748b; text-align: center; padding: 20px;">Fetching results...</p>';
        viewResultsBtn.textContent = 'Hide Results';

        try {
            const response = await fetch(`/api/results/student/${studentProfile.StudentID}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const results = await response.json();

            // Grouping logic
            const terms = ["First", "Second", "Third"];
            resultsContainer.innerHTML = '';

            terms.forEach(term => {
                const termResults = results.filter(r => r.Term.toLowerCase().includes(term.toLowerCase()));
                
                const termCard = document.createElement('div');
                termCard.style.cssText = 'background: white; border-radius: 12px; border: 1px solid #eaecf0; box-shadow: 0 1px 3px rgba(16,24,40,0.1); margin-bottom: 20px; overflow: hidden;';
                
                let termContent = `
                    <div style="background: #f8fafc; padding: 15px 20px; border-bottom: 1px solid #eaecf0; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="font-weight: 700; color: #1e293b; font-size: 18px; margin: 0;">${term} Term</h3>
                    </div>
                `;

                if (termResults.length > 0) {
                    let totalMarks = 0;
                    let obtainedMarks = 0;
                    
                    let rows = termResults.map(res => {
                        totalMarks += parseFloat(res.TotalMarks);
                        obtainedMarks += parseFloat(res.MarksObtained);
                        return `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 12px 20px; font-weight: 500; color: #475569;">${res.SubjectName}</td>
                                <td style="padding: 12px 20px; text-align: center; font-weight: 600; color: #1e293b;">${res.MarksObtained}</td>
                                <td style="padding: 12px 20px; text-align: center; color: #64748b;">${res.TotalMarks}</td>
                            </tr>
                        `;
                    }).join('');

                    termContent += `
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #fdfdfd; text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
                                    <th style="padding: 10px 20px;">Subject</th>
                                    <th style="padding: 10px 20px; text-align: center;">Obtained</th>
                                    <th style="padding: 10px 20px; text-align: center;">Total</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                        <div style="padding: 20px; background: #eff6ff; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 600; color: #1e40af;">Total Performance</span>
                            <span style="font-weight: 800; font-size: 20px; color: #1e3a8a;">${obtainedMarks} / ${totalMarks}</span>
                        </div>
                    `;
                } else {
                    termContent += `
                        <div style="padding: 40px; text-align: center;">
                            <p style="color: #94a3b8; font-style: italic; font-size: 15px;">No result has been uploaded yet for this term.</p>
                        </div>
                    `;
                }

                termCard.innerHTML = termContent;
                resultsContainer.appendChild(termCard);
            });

        } catch (error) {
            console.error('Error fetching results:', error);
            resultsContainer.innerHTML = '<div style="padding: 20px; background: white; border-radius: 12px; border: 1px solid #eaecf0; text-align: center; color: #ef4444;">Error loading results.</div>';
        }
    });

    // Logout
    document.querySelector('.sign-out').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = '../login.html';
    });
});
