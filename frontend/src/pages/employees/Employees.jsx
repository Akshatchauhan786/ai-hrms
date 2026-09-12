import { useEffect, useState } from "react";
import api from "../../api/api";

function Employees() {
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);

    const [loading, setLoading] = useState(true);
    const [loadingOptions, setLoadingOptions] = useState(true);

    const [error, setError] = useState("");
    const [formError, setFormError] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [showCredentialsModal, setShowCredentialsModal] = useState(false);
    const [credentials, setCredentials] = useState(null);

    const [saving, setSaving] = useState(false);
    const [viewing, setViewing] = useState(false);
    const [deactivating, setDeactivating] = useState(false);

    const [editingEmployeeId, setEditingEmployeeId] = useState(null);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    // Search / Filters
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [designationId, setDesignationId] = useState("");

    // Pagination
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });

    const [formData, setFormData] = useState({
        username: "",
        employee_code: "",
        first_name: "",
        last_name: "",
        phone: "",
        date_of_birth: "",
        department_id: "",
        designation_id: "",
        manager_id: "",
        joining_date: "",
        employment_type: "FULL_TIME",
        status: "ACTIVE",
    });

    /* =====================================================
       FETCH EMPLOYEES
    ===================================================== */

    const fetchEmployees = async (currentPage = page) => {
        try {
            setLoading(true);
            setError("");

            const params = {
                page: currentPage,
                limit,
            };

            if (search.trim()) {
                params.search = search.trim();
            }

            if (status) {
                params.status = status;
            }

            if (departmentId) {
                params.department_id = departmentId;
            }

            if (designationId) {
                params.designation_id = designationId;
            }

            const response = await api.get("/employees", {
                params,
            });

            setEmployees(
                response.data.data ||
                response.data.employees ||
                []
            );

            if (response.data.pagination) {
                setPagination(response.data.pagination);
            }
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Failed to fetch employees"
            );
        } finally {
            setLoading(false);
        }
    };

    /* =====================================================
       FETCH DEPARTMENTS + DESIGNATIONS
    ===================================================== */

    useEffect(() => {
        const fetchFormOptions = async () => {
            try {
                setLoadingOptions(true);

                const [
                    departmentResponse,
                    designationResponse,
                ] = await Promise.all([
                    api.get("/departments"),
                    api.get("/designations"),
                ]);

                setDepartments(
                    departmentResponse.data.data ||
                    departmentResponse.data.departments ||
                    []
                );

                setDesignations(
                    designationResponse.data.data ||
                    designationResponse.data.designations ||
                    []
                );
            } catch (error) {
                console.error(
                    "Failed to load departments/designations:",
                    error
                );
            } finally {
                setLoadingOptions(false);
            }
        };

        fetchFormOptions();
    }, []);

    /* =====================================================
       INITIAL FETCH
    ===================================================== */

    useEffect(() => {
        fetchEmployees(1);
    }, []);

    /* =====================================================
       SEARCH / FILTER
    ===================================================== */

    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchEmployees(1);
        }, 400);

        return () => clearTimeout(timer);
    }, [
        search,
        status,
        departmentId,
        designationId,
    ]);

    /* =====================================================
       FORM HANDLERS
    ===================================================== */

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const resetForm = () => {
        setFormData({
            username: "",
            employee_code: "",
            first_name: "",
            last_name: "",
            phone: "",
            date_of_birth: "",
            department_id: "",
            designation_id: "",
            manager_id: "",
            joining_date: "",
            employment_type: "FULL_TIME",
            status: "ACTIVE",
        });

        setFormError("");
        setEditingEmployeeId(null);
    };

    const handleCloseModal = () => {
        if (saving) return;

        setShowModal(false);
        resetForm();
    };

    /* =====================================================
       ADD EMPLOYEE
    ===================================================== */

    const handleAddEmployee = () => {
        resetForm();
        setShowModal(true);
    };

    /* =====================================================
       EDIT EMPLOYEE
    ===================================================== */

    const handleEdit = async (employee) => {
        try {
            setFormError("");
            setSaving(false);

            const response = await api.get(
                `/employees/${employee.id}`
            );

            const data = response.data.data;

            setEditingEmployeeId(employee.id);

            setFormData({
                username:
                    data.username ||
                    data.user?.username ||
                    data.user_username ||
                    "",
                employee_code: data.employee_code || "",
                first_name: data.first_name || "",
                last_name: data.last_name || "",
                phone: data.phone || "",
                date_of_birth: data.date_of_birth
                    ? data.date_of_birth.substring(0, 10)
                    : "",
                department_id: data.department_id || "",
                designation_id: data.designation_id || "",
                manager_id: data.manager_id || "",
                joining_date: data.joining_date
                    ? data.joining_date.substring(0, 10)
                    : "",
                employment_type:
                    data.employment_type || "FULL_TIME",
                status: data.status || "ACTIVE",
            });

            setShowModal(true);
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Failed to load employee"
            );
        }
    };

    /* =====================================================
       VIEW EMPLOYEE
    ===================================================== */

    const handleView = async (employee) => {
        try {
            setViewing(true);
            setSelectedEmployee(null);
            setShowViewModal(true);

            const response = await api.get(
                `/employees/${employee.id}`
            );

            setSelectedEmployee(response.data.data);
        } catch (error) {
            setShowViewModal(false);

            setError(
                error.response?.data?.message ||
                "Failed to load employee details"
            );
        } finally {
            setViewing(false);
        }
    };

    /* =====================================================
       CREATE / UPDATE
    ===================================================== */

    const handleSubmit = async (e) => {
        e.preventDefault();

        setFormError("");

        if (!editingEmployeeId && !formData.username.trim()) {
            setFormError("Username is required");
            return;
        }

        if (!formData.employee_code.trim()) {
            setFormError("Employee code is required");
            return;
        }

        if (!formData.first_name.trim()) {
            setFormError("First name is required");
            return;
        }

        if (
            formData.manager_id &&
            editingEmployeeId &&
            Number(formData.manager_id) ===
            Number(editingEmployeeId)
        ) {
            setFormError(
                "Employee cannot be their own manager"
            );
            return;
        }

        try {
            setSaving(true);

            const payload = {
                ...(editingEmployeeId
                    ? {}
                    : { username: formData.username.trim() }),

                employee_code:
                    formData.employee_code.trim(),

                first_name:
                    formData.first_name.trim(),

                last_name:
                    formData.last_name.trim() || null,

                phone:
                    formData.phone.trim() || null,

                date_of_birth:
                    formData.date_of_birth || null,

                department_id:
                    formData.department_id || null,

                designation_id:
                    formData.designation_id || null,

                manager_id:
                    formData.manager_id || null,

                joining_date:
                    formData.joining_date || null,

                employment_type:
                    formData.employment_type,

                status:
                    formData.status || "ACTIVE",
            };

            let response;

            if (editingEmployeeId) {
                response = await api.put(
                    `/employees/${editingEmployeeId}`,
                    payload
                );
            } else {
                response = await api.post(
                    "/employees",
                    payload
                );

                // Backend should return generated login credentials only once
                // after creating a new employee.
                const loginDetails =
                    response?.data?.loginDetails ||
                    response?.data?.login_details ||
                    response?.data?.credentials ||
                    response?.data?.data?.loginDetails ||
                    null;

                if (loginDetails) {
                    setCredentials(loginDetails);
                    setShowCredentialsModal(true);
                }
            }

            setShowModal(false);
            resetForm();

            await fetchEmployees(page);
        } catch (error) {
            setFormError(
                error.response?.data?.message ||
                (
                    editingEmployeeId
                        ? "Failed to update employee"
                        : "Failed to create employee"
                )
            );
        } finally {
            setSaving(false);
        }
    };

    /* =====================================================
       DEACTIVATE
    ===================================================== */

    const handleDeactivateClick = (employee) => {
        setSelectedEmployee(employee);
        setShowDeactivateModal(true);
    };

    const handleDeactivate = async () => {
        if (!selectedEmployee) return;

        try {
            setDeactivating(true);

            await api.delete(
                `/employees/${selectedEmployee.id}`
            );

            setShowDeactivateModal(false);
            setSelectedEmployee(null);

            await fetchEmployees(page);
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Failed to deactivate employee"
            );
        } finally {
            setDeactivating(false);
        }
    };

    /* =====================================================
       ACTIVATE
    ===================================================== */

    const handleActivate = async (employee) => {
        try {
            await api.put(
                `/employees/${employee.id}`,
                {
                    employee_code: employee.employee_code,
                    first_name: employee.first_name,
                    last_name: employee.last_name || null,
                    phone: employee.phone || null,
                    joining_date:
                        employee.joining_date || null,
                    employment_type:
                        employee.employment_type ||
                        "FULL_TIME",
                    status: "ACTIVE",
                }
            );

            await fetchEmployees(page);
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Failed to activate employee"
            );
        }
    };

    /* =====================================================
       PAGINATION
    ===================================================== */

    const handlePageChange = (newPage) => {
        if (
            newPage < 1 ||
            newPage > pagination.totalPages
        ) {
            return;
        }

        setPage(newPage);
        fetchEmployees(newPage);
    };

    /* =====================================================
       RENDER
    ===================================================== */

    return (
        <div className="employees-page">

            {/* PAGE HEADER */}

            <div className="page-header employee-header">
                <div>
                    <h1>Employees</h1>

                    <p>
                        Manage your organization's employees.
                    </p>
                </div>

                <button
                    className="primary-button"
                    onClick={handleAddEmployee}
                >
                    + Add Employee
                </button>
            </div>


            {/* FILTER BAR */}

            <div className="employee-filters">

                <div className="search-wrapper">
                    <input
                        type="text"
                        placeholder="Search employee..."
                        value={search}
                        onChange={(e) =>
                            setSearch(e.target.value)
                        }
                        className="search-input"
                    />
                </div>

                <select
                    value={departmentId}
                    onChange={(e) =>
                        setDepartmentId(e.target.value)
                    }
                    className="filter-select"
                >
                    <option value="">
                        All Departments
                    </option>

                    {departments.map((department) => (
                        <option
                            key={department.id}
                            value={department.id}
                        >
                            {department.name}
                        </option>
                    ))}
                </select>

                <select
                    value={designationId}
                    onChange={(e) =>
                        setDesignationId(e.target.value)
                    }
                    className="filter-select"
                >
                    <option value="">
                        All Designations
                    </option>

                    {designations.map((designation) => (
                        <option
                            key={designation.id}
                            value={designation.id}
                        >
                            {designation.name}
                        </option>
                    ))}
                </select>

                <select
                    value={status}
                    onChange={(e) =>
                        setStatus(e.target.value)
                    }
                    className="filter-select"
                >
                    <option value="">
                        All Status
                    </option>

                    <option value="ACTIVE">
                        Active
                    </option>

                    <option value="INACTIVE">
                        Inactive
                    </option>
                </select>

                <button
                    className="refresh-button"
                    onClick={() =>
                        fetchEmployees(page)
                    }
                >
                    ↻ Refresh
                </button>

            </div>


            {/* EMPLOYEE CARD */}

            <div className="employee-card">

                <div className="table-header">
                    <div>
                        <h3>All Employees</h3>

                        <p>
                            {pagination.total ||
                                employees.length}{" "}
                            employee(s)
                        </p>
                    </div>
                </div>


                {loading && (
                    <div className="table-message">
                        Loading employees...
                    </div>
                )}


                {error && (
                    <div className="table-error">
                        {error}
                    </div>
                )}


                {!loading &&
                    !error &&
                    employees.length === 0 && (
                        <div className="table-message">
                            No employees found.
                        </div>
                    )}


                {!loading &&
                    employees.length > 0 && (
                        <div className="table-wrapper">

                            <table className="employee-table">

                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Code</th>
                                        <th>Phone</th>
                                        <th>Department</th>
                                        <th>Designation</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>


                                <tbody>

                                    {employees.map(
                                        (employee) => (
                                            <tr
                                                key={
                                                    employee.id
                                                }
                                            >

                                                <td>
                                                    <div className="employee-name">

                                                        <div className="employee-avatar">
                                                            {employee.first_name
                                                                ?.charAt(
                                                                    0
                                                                )
                                                                ?.toUpperCase()}
                                                        </div>

                                                        <strong>
                                                            {
                                                                employee.first_name
                                                            }{" "}
                                                            {employee.last_name ||
                                                                ""}
                                                        </strong>

                                                    </div>
                                                </td>


                                                <td>
                                                    {
                                                        employee.employee_code
                                                    }
                                                </td>


                                                <td>
                                                    {employee.phone ||
                                                        "-"}
                                                </td>


                                                <td>
                                                    {
                                                        employee.department_name ||
                                                        "-"
                                                    }
                                                </td>


                                                <td>
                                                    {
                                                        employee.designation_name ||
                                                        "-"
                                                    }
                                                </td>


                                                <td>

                                                    <span
                                                        className={`status-badge ${employee.status?.toLowerCase() ||
                                                            "active"
                                                            }`}
                                                    >
                                                        {employee.status ||
                                                            "ACTIVE"}
                                                    </span>

                                                </td>


                                                <td>

                                                    <div className="employee-actions">

                                                        <button
                                                            className="action-button view"
                                                            onClick={() =>
                                                                handleView(
                                                                    employee
                                                                )
                                                            }
                                                            title="View"
                                                        >
                                                            👁
                                                        </button>

                                                        <button
                                                            className="action-button edit"
                                                            onClick={() =>
                                                                handleEdit(
                                                                    employee
                                                                )
                                                            }
                                                            title="Edit"
                                                        >
                                                            ✏️
                                                        </button>


                                                        {employee.status ===
                                                            "INACTIVE" ? (
                                                            <button
                                                                className="action-button activate"
                                                                onClick={() =>
                                                                    handleActivate(
                                                                        employee
                                                                    )
                                                                }
                                                                title="Activate"
                                                            >
                                                                ✓
                                                            </button>
                                                        ) : (
                                                            <button
                                                                className="action-button deactivate"
                                                                onClick={() =>
                                                                    handleDeactivateClick(
                                                                        employee
                                                                    )
                                                                }
                                                                title="Deactivate"
                                                            >
                                                                ⛔
                                                            </button>
                                                        )}

                                                    </div>

                                                </td>

                                            </tr>
                                        )
                                    )}

                                </tbody>

                            </table>

                        </div>
                    )}


                {/* PAGINATION */}

                {!loading &&
                    pagination.totalPages > 1 && (
                        <div className="employee-pagination">

                            <button
                                className="pagination-button"
                                disabled={
                                    page === 1
                                }
                                onClick={() =>
                                    handlePageChange(
                                        page - 1
                                    )
                                }
                            >
                                Previous
                            </button>


                            <span>
                                Page {page} of{" "}
                                {
                                    pagination.totalPages
                                }
                            </span>


                            <button
                                className="pagination-button"
                                disabled={
                                    page ===
                                    pagination.totalPages
                                }
                                onClick={() =>
                                    handlePageChange(
                                        page + 1
                                    )
                                }
                            >
                                Next
                            </button>

                        </div>
                    )}

            </div>


            {/* =================================================
                ADD / EDIT MODAL
            ================================================= */}

            {showModal && (
                <div
                    className="modal-overlay"
                    onMouseDown={(e) => {
                        if (
                            e.target ===
                            e.currentTarget
                        ) {
                            handleCloseModal();
                        }
                    }}
                >

                    <div className="employee-modal">

                        <div className="modal-header">

                            <div>
                                <h2>
                                    {editingEmployeeId
                                        ? "Edit Employee"
                                        : "Add Employee"}
                                </h2>

                                <p>
                                    {editingEmployeeId
                                        ? "Update employee information"
                                        : "Create a new employee profile"}
                                </p>
                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                onClick={
                                    handleCloseModal
                                }
                                disabled={saving}
                            >
                                ×
                            </button>

                        </div>


                        <form
                            className="employee-form"
                            onSubmit={handleSubmit}
                        >

                            {formError && (
                                <div className="form-error">
                                    {formError}
                                </div>
                            )}


                            <div className="form-grid">

                                {!editingEmployeeId && (
                                    <div className="form-group">
                                        <label>
                                            Username *
                                        </label>

                                        <input
                                            type="text"
                                            name="username"
                                            value={formData.username}
                                            onChange={handleChange}
                                            placeholder="e.g. akshat"
                                            autoComplete="off"
                                            required
                                        />

                                        <small className="form-help">
                                            Login username. Email and default
                                            password will be generated automatically.
                                        </small>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>
                                        Employee Code *
                                    </label>

                                    <input
                                        type="text"
                                        name="employee_code"
                                        value={
                                            formData.employee_code
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        placeholder="EMP002"
                                    />
                                </div>


                                <div className="form-group">
                                    <label>
                                        First Name *
                                    </label>

                                    <input
                                        type="text"
                                        name="first_name"
                                        value={
                                            formData.first_name
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        placeholder="First name"
                                    />
                                </div>


                                <div className="form-group">
                                    <label>
                                        Last Name
                                    </label>

                                    <input
                                        type="text"
                                        name="last_name"
                                        value={
                                            formData.last_name
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        placeholder="Last name"
                                    />
                                </div>


                                <div className="form-group">
                                    <label>
                                        Phone
                                    </label>

                                    <input
                                        type="tel"
                                        name="phone"
                                        value={
                                            formData.phone
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        placeholder="Phone number"
                                    />
                                </div>


                                <div className="form-group">
                                    <label>
                                        Date of Birth
                                    </label>

                                    <input
                                        type="date"
                                        name="date_of_birth"
                                        value={
                                            formData.date_of_birth
                                        }
                                        onChange={
                                            handleChange
                                        }
                                    />
                                </div>


                                <div className="form-group">
                                    <label>
                                        Joining Date
                                    </label>

                                    <input
                                        type="date"
                                        name="joining_date"
                                        value={
                                            formData.joining_date
                                        }
                                        onChange={
                                            handleChange
                                        }
                                    />
                                </div>


                                <div className="form-group">
                                    <label>
                                        Department
                                    </label>

                                    <select
                                        name="department_id"
                                        value={
                                            formData.department_id
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        disabled={
                                            loadingOptions
                                        }
                                    >
                                        <option value="">
                                            {loadingOptions
                                                ? "Loading departments..."
                                                : "Select Department"}
                                        </option>

                                        {departments.map(
                                            (department) => (
                                                <option
                                                    key={
                                                        department.id
                                                    }
                                                    value={
                                                        department.id
                                                    }
                                                >
                                                    {
                                                        department.name
                                                    }
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>


                                <div className="form-group">
                                    <label>
                                        Designation
                                    </label>

                                    <select
                                        name="designation_id"
                                        value={
                                            formData.designation_id
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        disabled={
                                            loadingOptions
                                        }
                                    >
                                        <option value="">
                                            {loadingOptions
                                                ? "Loading designations..."
                                                : "Select Designation"}
                                        </option>

                                        {designations.map(
                                            (designation) => (
                                                <option
                                                    key={
                                                        designation.id
                                                    }
                                                    value={
                                                        designation.id
                                                    }
                                                >
                                                    {
                                                        designation.name
                                                    }
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>


                                <div className="form-group">
                                    <label>
                                        Manager
                                    </label>

                                    <select
                                        name="manager_id"
                                        value={
                                            formData.manager_id
                                        }
                                        onChange={
                                            handleChange
                                        }
                                    >
                                        <option value="">
                                            Select Manager
                                        </option>

                                        {employees
                                            .filter(
                                                (employee) =>
                                                    !editingEmployeeId ||
                                                    Number(
                                                        employee.id
                                                    ) !==
                                                    Number(
                                                        editingEmployeeId
                                                    )
                                            )
                                            .map(
                                                (
                                                    employee
                                                ) => (
                                                    <option
                                                        key={
                                                            employee.id
                                                        }
                                                        value={
                                                            employee.id
                                                        }
                                                    >
                                                        {
                                                            employee.first_name
                                                        }{" "}
                                                        {employee.last_name ||
                                                            ""}{" "}
                                                        (
                                                        {
                                                            employee.employee_code
                                                        }
                                                        )
                                                    </option>
                                                )
                                            )}
                                    </select>
                                </div>


                                <div className="form-group">
                                    <label>
                                        Employment Type
                                    </label>

                                    <select
                                        name="employment_type"
                                        value={
                                            formData.employment_type
                                        }
                                        onChange={
                                            handleChange
                                        }
                                    >
                                        <option value="FULL_TIME">
                                            Full Time
                                        </option>

                                        <option value="PART_TIME">
                                            Part Time
                                        </option>

                                        <option value="CONTRACT">
                                            Contract
                                        </option>

                                        <option value="INTERN">
                                            Intern
                                        </option>
                                    </select>
                                </div>


                                {editingEmployeeId && (
                                    <div className="form-group">
                                        <label>
                                            Status
                                        </label>

                                        <select
                                            name="status"
                                            value={
                                                formData.status
                                            }
                                            onChange={
                                                handleChange
                                            }
                                        >
                                            <option value="ACTIVE">
                                                Active
                                            </option>

                                            <option value="INACTIVE">
                                                Inactive
                                            </option>
                                        </select>
                                    </div>
                                )}

                            </div>


                            <div className="modal-footer">

                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={
                                        handleCloseModal
                                    }
                                    disabled={saving}
                                >
                                    Cancel
                                </button>


                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={saving}
                                >
                                    {saving
                                        ? editingEmployeeId
                                            ? "Updating..."
                                            : "Creating..."
                                        : editingEmployeeId
                                            ? "Update Employee"
                                            : "Create Employee"}
                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}


            {/* =================================================
                VIEW MODAL
            ================================================= */}

            {showViewModal && (
                <div
                    className="modal-overlay"
                    onMouseDown={(e) => {
                        if (
                            e.target ===
                            e.currentTarget
                        ) {
                            setShowViewModal(false);
                        }
                    }}
                >

                    <div className="employee-modal view-modal">

                        <div className="modal-header">

                            <div>
                                <h2>
                                    Employee Details
                                </h2>

                                <p>
                                    Complete employee information
                                </p>
                            </div>

                            <button
                                className="modal-close"
                                onClick={() =>
                                    setShowViewModal(
                                        false
                                    )
                                }
                            >
                                ×
                            </button>

                        </div>


                        <div className="view-modal-body">

                            {viewing && (
                                <div className="table-message">
                                    Loading employee details...
                                </div>
                            )}


                            {!viewing &&
                                selectedEmployee && (
                                    <>

                                        <div className="employee-profile">

                                            <div className="large-avatar">
                                                {selectedEmployee.first_name
                                                    ?.charAt(
                                                        0
                                                    )
                                                    ?.toUpperCase()}
                                            </div>

                                            <div>
                                                <h3>
                                                    {
                                                        selectedEmployee.first_name
                                                    }{" "}
                                                    {
                                                        selectedEmployee.last_name ||
                                                        ""
                                                    }
                                                </h3>

                                                <p>
                                                    {
                                                        selectedEmployee.employee_code
                                                    }
                                                </p>
                                            </div>

                                        </div>


                                        <div className="details-grid">

                                            <div>
                                                <span>
                                                    Username
                                                </span>

                                                <strong>
                                                    {selectedEmployee.username ||
                                                        selectedEmployee.user?.username ||
                                                        selectedEmployee.user_username ||
                                                        "-"}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Phone
                                                </span>

                                                <strong>
                                                    {
                                                        selectedEmployee.phone ||
                                                        "-"
                                                    }
                                                </strong>
                                            </div>


                                            <div>
                                                <span>
                                                    Date of Birth
                                                </span>

                                                <strong>
                                                    {
                                                        selectedEmployee.date_of_birth
                                                            ? selectedEmployee.date_of_birth.substring(
                                                                0,
                                                                10
                                                            )
                                                            : "-"
                                                    }
                                                </strong>
                                            </div>


                                            <div>
                                                <span>
                                                    Department
                                                </span>

                                                <strong>
                                                    {
                                                        selectedEmployee.department_name ||
                                                        "-"
                                                    }
                                                </strong>
                                            </div>


                                            <div>
                                                <span>
                                                    Designation
                                                </span>

                                                <strong>
                                                    {
                                                        selectedEmployee.designation_name ||
                                                        "-"
                                                    }
                                                </strong>
                                            </div>


                                            <div>
                                                <span>
                                                    Manager
                                                </span>

                                                <strong>
                                                    {
                                                        selectedEmployee.manager_name ||
                                                        "-"
                                                    }
                                                </strong>
                                            </div>


                                            <div>
                                                <span>
                                                    Joining Date
                                                </span>

                                                <strong>
                                                    {
                                                        selectedEmployee.joining_date
                                                            ? selectedEmployee.joining_date.substring(
                                                                0,
                                                                10
                                                            )
                                                            : "-"
                                                    }
                                                </strong>
                                            </div>


                                            <div>
                                                <span>
                                                    Employment Type
                                                </span>

                                                <strong>
                                                    {
                                                        selectedEmployee.employment_type ||
                                                        "-"
                                                    }
                                                </strong>
                                            </div>


                                            <div>
                                                <span>
                                                    Status
                                                </span>

                                                <strong>
                                                    {
                                                        selectedEmployee.status ||
                                                        "ACTIVE"
                                                    }
                                                </strong>
                                            </div>

                                        </div>

                                    </>
                                )}

                        </div>

                    </div>

                </div>
            )}


            {/* =================================================
                DEACTIVATE CONFIRMATION MODAL
            ================================================= */}

            {showDeactivateModal &&
                selectedEmployee && (
                    <div
                        className="modal-overlay"
                        onMouseDown={(e) => {
                            if (
                                e.target ===
                                e.currentTarget &&
                                !deactivating
                            ) {
                                setShowDeactivateModal(
                                    false
                                );
                            }
                        }}
                    >

                        <div className="employee-modal confirmation-modal">

                            <div className="modal-header">

                                <div>
                                    <h2>
                                        Deactivate Employee
                                    </h2>

                                    <p>
                                        Please confirm this action
                                    </p>
                                </div>

                                <button
                                    className="modal-close"
                                    onClick={() =>
                                        setShowDeactivateModal(
                                            false
                                        )
                                    }
                                    disabled={
                                        deactivating
                                    }
                                >
                                    ×
                                </button>

                            </div>


                            <div className="confirmation-body">

                                <div className="warning-icon">
                                    !
                                </div>

                                <h3>
                                    Deactivate{" "}
                                    {
                                        selectedEmployee.first_name
                                    }{" "}
                                    {
                                        selectedEmployee.last_name ||
                                        ""
                                    }?
                                </h3>

                                <p>
                                    This employee will be marked
                                    as inactive. Their data will
                                    not be permanently deleted.
                                </p>

                            </div>


                            <div className="modal-footer">

                                <button
                                    className="secondary-button"
                                    onClick={() =>
                                        setShowDeactivateModal(
                                            false
                                        )
                                    }
                                    disabled={
                                        deactivating
                                    }
                                >
                                    Cancel
                                </button>

                                <button
                                    className="danger-button"
                                    onClick={
                                        handleDeactivate
                                    }
                                    disabled={
                                        deactivating
                                    }
                                >
                                    {deactivating
                                        ? "Deactivating..."
                                        : "Yes, Deactivate"}
                                </button>

                            </div>

                        </div>

                    </div>
                )}

                {showCredentialsModal && credentials && (
                    <div className="modal-overlay">
                        <div className="employee-modal credentials-modal">
                            <div className="modal-header">
                                <div>
                                    <h2>Employee Login Credentials</h2>
                                    <p>Share these details securely with the employee.</p>
                                </div>
                                <button
                                    type="button"
                                    className="modal-close"
                                    onClick={() => {
                                        setShowCredentialsModal(false);
                                        setCredentials(null);
                                    }}
                                >
                                    ×
                                </button>
                            </div>

                            <div className="credentials-content">
                                <div className="credentials-success">
                                    <span>✓</span>
                                    Employee created successfully.
                                </div>

                                <div className="credential-row">
                                    <label>Email</label>
                                    <div className="credential-value">
                                        <span>{credentials.email || credentials.username || "N/A"}</span>
                                        <button
                                            type="button"
                                            className="copy-credential-button"
                                            onClick={() =>
                                                navigator.clipboard?.writeText(
                                                    credentials.email || credentials.username || ""
                                                )
                                            }
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>

                                <div className="credential-row">
                                    <label>Password</label>
                                    <div className="credential-value">
                                        <span>{credentials.password || credentials.defaultPassword || "N/A"}</span>
                                        <button
                                            type="button"
                                            className="copy-credential-button"
                                            onClick={() =>
                                                navigator.clipboard?.writeText(
                                                    credentials.password || credentials.defaultPassword || ""
                                                )
                                            }
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>

                                <div className="credentials-warning">
                                    Please save these credentials now. The password may not be shown again.
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="primary-button"
                                    onClick={() => {
                                        setShowCredentialsModal(false);
                                        setCredentials(null);
                                    }}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}

        </div>
    );
}

export default Employees;