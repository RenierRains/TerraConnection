document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const toggleSidebar = document.getElementById('toggle-sidebar');
    const mainContent = document.getElementById('main-content');
    const menuItems = document.querySelectorAll('.sidebar-nav a');
    const logoutButton = document.getElementById('logout');

    // Mock data (replace with actual API calls in a real application)
    let users = [
        { id: 1, name: "John Doe", email: "john@example.com", role: "Student" },
        { id: 2, name: "Jane Smith", email: "jane@example.com", role: "Teacher" },
    ];
    let classes = [
        { id: 1, name: "Math 101", teacher: "Jane Smith", students: 25 },
        { id: 2, name: "History 202", teacher: "Bob Johnson", students: 30 },
    ];
    let rfidCards = [
        { id: "ABC123", user: "John Doe", status: "Active" },
        { id: "DEF456", user: "Jane Smith", status: "Inactive" },
    ];
    let auditLogs = [
        { id: 1, action: "User Login", user: "John Doe", timestamp: "2023-06-15 09:30:00" },
        { id: 2, action: "Class Created", user: "Jane Smith", timestamp: "2023-06-15 10:15:00" },
    ];

    toggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.closest('a').dataset.page;
            updateContent(page);
        });
    });

    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });

    function updateContent(page) {
        let content = '';
        switch (page) {
            case 'dashboard':
                content = generateDashboardContent();
                break;
            case 'users':
                content = generateUsersContent();
                break;
            case 'classes':
                content = generateClassesContent();
                break;
            case 'rfid':
                content = generateRFIDContent();
                break;
            case 'audit':
                content = generateAuditContent();
                break;
            case 'link':
                content = generateLinkContent();
                break;
            default:
                content = '<h2>Welcome to the Admin Dashboard</h2><p>Select a menu item to get started.</p>';
        }
        mainContent.innerHTML = content;
        addEventListeners(page);
    }

    function generateDashboardContent() {
        return `
            <h2>Dashboard</h2>
            <div class="dashboard-stats">
                <div class="stat-card">
                    <h3>Total Users</h3>
                    <p>${users.length}</p>
                </div>
                <div class="stat-card">
                    <h3>Active Classes</h3>
                    <p>${classes.length}</p>
                </div>
                <div class="stat-card">
                    <h3>RFID Cards Issued</h3>
                    <p>${rfidCards.length}</p>
                </div>
                <div class="stat-card">
                    <h3>Recent Logins</h3>
                    <p>${auditLogs.filter(log => log.action === "User Login").length}</p>
                </div>
            </div>
        `;
    }

    // Update the generateUsersContent function in your script.js
function generateUsersContent() {
    let usersList = users.map(user => `
        <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>
                <div class="action-buttons">
                    <button class="edit-button" onclick="editUser(${user.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="delete-button" onclick="deleteUser(${user.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    return `
        <div class="page-header">
            <h2>Manage Users</h2>
            <button class="action-button" onclick="addUser()">
                <i class="fas fa-plus"></i> Add New User
            </button>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${usersList}
            </tbody>
        </table>
    `;
}

// Update other content generation functions similarly
function generateClassesContent() {
    let classesList = classes.map(cls => `
        <tr>
            <td>${cls.name}</td>
            <td>${cls.teacher}</td>
            <td>${cls.students}</td>
            <td>
                <div class="action-buttons">
                    <button class="edit-button" onclick="editClass(${cls.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="delete-button" onclick="deleteClass(${cls.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    return `
        <div class="page-header">
            <h2>Manage Classes</h2>
            <button class="action-button" onclick="addClass()">
                <i class="fas fa-plus"></i> Add New Class
            </button>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Class Name</th>
                    <th>Teacher</th>
                    <th>Students</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${classesList}
            </tbody>
        </table>
    `;
}

// Similar updates for RFID cards and other pages...

function generateRFIDContent() {
    let rfidList = rfidCards.map(card => `
        <tr>
            <td>${card.id}</td>
            <td>${card.user}</td>
            <td>${card.status}</td>
            <td>
                <button class="edit-button" onclick="editRFID('${card.id}')">Edit</button>
                <button class="delete-button" onclick="deleteRFID('${card.id}')">Delete</button>
            </td>
        </tr>
    `).join('');

    return `
        <h2>Manage RFID Cards</h2>
        <button class="action-button" onclick="addRFID()">Add New RFID Card</button>
        <table>
            <thead>
                <tr>
                    <th>Card ID</th>
                    <th>Assigned User</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${rfidList}
            </tbody>
        </table>
    `;
}

    function generateAuditContent() {
        let auditList = auditLogs.map(log => `
            <tr>
                <td>${log.action}</td>
                <td>${log.user}</td>
                <td>${log.timestamp}</td>
            </tr>
        `).join('');

        return `
            <h2>View Audit Logs</h2>
            <table>
                <thead>
                    <tr>
                        <th>Action</th>
                        <th>User</th>
                        <th>Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    ${auditList}
                </tbody>
            </table>
        `;
    }

    function generateLinkContent() {
        let studentOptions = users.filter(user => user.role === "Student")
            .map(user => `<option value="${user.id}">${user.name}</option>`)
            .join('');
            
        let guardianOptions = users.filter(user => user.role === "Guardian")
            .map(user => `<option value="${user.id}">${user.name}</option>`)
            .join('');
    
        return `
            <div class="page-header">
                <h2>Link Guardian to Student</h2>
            </div>
            <form onsubmit="linkGuardianToStudent(event)">
                <div class="form-group">
                    <label for="student">Select Student:</label>
                    <select id="student" name="student" class="form-control">
                        ${studentOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label for="guardian">Select Guardian:</label>
                    <select id="guardian" name="guardian" class="form-control">
                        ${guardianOptions}
                    </select>
                </div>
                <button type="submit" class="action-button">Link</button>
            </form>
        `;
    }

    function addEventListeners(page) {
        if (page === 'link') {
            document.querySelector('form').addEventListener('submit', linkGuardianToStudent);
        }
    }

    // Set dashboard as the default view
    updateContent('dashboard');

    // Make these functions global so they can be called from inline event handlers
    window.addUser = addUser;
    window.editUser = editUser;
    window.deleteUser = deleteUser;
    window.addClass = addClass;
    window.editClass = editClass;
    window.deleteClass = deleteClass;
    window.addRFID = addRFID;
    window.editRFID = editRFID;
    window.deleteRFID = deleteRFID;
    window.linkGuardianToStudent = linkGuardianToStudent;
});

// User management functions
function addUser() {
    let name = prompt("Enter user name:");
    let email = prompt("Enter user email:");
    let role = prompt("Enter user role (Student/Teacher/Guardian):");
    if (name && email && role) {
        users.push({ id: users.length + 1, name, email, role });
        updateContent('users');
    }
}

function editUser(id) {
    let user = users.find(u => u.id === id);
    if (user) {
        user.name = prompt("Enter new name:", user.name);
        user.email = prompt("Enter new email:", user.email);
        user.role = prompt("Enter new role:", user.role);
        updateContent('users');
    }
}

function deleteUser(id) {
    if (confirm("Are you sure you want to delete this user?")) {
        users = users.filter(u => u.id !== id);
        updateContent('users');
    }
}

// Class management functions
function addClass() {
    let name = prompt("Enter class name:");
    let teacher = prompt("Enter teacher name:");
    let students = prompt("Enter number of students:");
    if (name && teacher && students) {
        classes.push({ id: classes.length + 1, name, teacher, students: parseInt(students) });
        updateContent('classes');
    }
}

function editClass(id) {
    let cls = classes.find(c => c.id === id);
    if (cls) {
        cls.name = prompt("Enter new class name:", cls.name);
        cls.teacher = prompt("Enter new teacher name:", cls.teacher);
        cls.students = parseInt(prompt("Enter new number of students:", cls.students));
        updateContent('classes');
    }
}

function deleteClass(id) {
    if (confirm("Are you sure you want to delete this class?")) {
        classes = classes.filter(c => c.id !== id);
        updateContent('classes');
    }
}

// RFID management functions
function addRFID() {
    let id = prompt("Enter RFID card ID:");
    let user = prompt("Enter assigned user:");
    let status = prompt("Enter card status (Active/Inactive):");
    if (id && user && status) {
        rfidCards.push({ id, user, status });
        updateContent('rfid');
    }
}

function editRFID(id) {
    let card = rfidCards.find(c => c.id === id);
    if (card) {
        card.user = prompt("Enter new assigned user:", card.user);
        card.status = prompt("Enter new status (Active/Inactive):", card.status);
        updateContent('rfid');
    }
}

function deleteRFID(id) {
    if (confirm("Are you sure you want to delete this RFID card?")) {
        rfidCards = rfidCards.filter(c => c.id !== id);
        updateContent('rfid');
    }
}

// Link Guardian to Student function
function linkGuardianToStudent(event) {
    event.preventDefault();
    let studentId = document.getElementById('student').value;
    let guardianId = document.getElementById('guardian').value;
    alert(`Linked student ${studentId} to guardian ${guardianId}`);
    // In a real application, this would update the database
}

// Logout function
function logout() {
    if (confirm("Are you sure you want to log out?")) {
        alert("You have been logged out.");
        // In a real application, this would redirect to a login page or perform a logout action
    }
}

function updateContent(page) {
    // This function should be defined in your main script
    // It updates the content based on the selected page
}