import { useEffect, useState } from "react";
import api from "../../api/api";

function Employees() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    const [formData, setFormData] = useState({
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
    });
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(true);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            setError("");

            const response = await api.get("/employees");

            setEmployees(
                response.data.data ||
                response.data.employees ||
                []
            );
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Failed to fetch employees"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);
    useEffect(() => {
        const fetchFormOptions = async () => {
            try {
                setLoadingOptions(true);

                const [departmentResponse, designationResponse] =
                    await Promise.all([
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

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const resetForm = () => {
        setFormData({
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
        });

        setFormError("");
    };

    const handleCloseModal = () => {
        if (saving) return;

        setShowModal(false);
        resetForm();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setFormError("");

        if (!formData.employee_code.trim()) {
            setFormError("Employee code is required");
            return;
        }

        if (!formData.first_name.trim()) {
            setFormError("First name is required");
            return;
        }

        try {
            setSaving(true);

            const payload = {
                employee_code: formData.employee_code.trim(),
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim() || null,
                phone: formData.phone.trim() || null,
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
            };

            await api.post("/employees", payload);

            setShowModal(false);
            resetForm();

            await fetchEmployees();
        } catch (error) {
            setFormError(
                error.response?.data?.message ||
                "Failed to create employee"
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="employees-page">

            <div className="page-header employee-header">
                <div>
                    <h1>Employees</h1>
                    <p>
                        Manage your organization's employees.
                    </p>
                </div>

                <button
                    className="primary-button"
                    onClick={() => setShowModal(true)}
                >
                    + Add Employee
                </button>
            </div>

            <div className="employee-card">

                <div className="table-header">
                    <div>
                        <h3>All Employees</h3>
                        <p>
                            {employees.length} employee(s)
                        </p>
                    </div>

                    <button
                        className="refresh-button"
                        onClick={fetchEmployees}
                    >
                        ↻ Refresh
                    </button>
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

                {!loading && !error && (
                    employees.length === 0 ? (
                        <div className="table-message">
                            No employees found.
                        </div>
                    ) : (
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
                                    </tr>
                                </thead>

                                <tbody>
                                    {employees.map((employee) => (
                                        <tr key={employee.id}>
                                            <td>
                                                <div className="employee-name">
                                                    <div className="employee-avatar">
                                                        {employee.first_name
                                                            ?.charAt(0)
                                                            ?.toUpperCase()}
                                                    </div>

                                                    <strong>
                                                        {employee.first_name}{" "}
                                                        {employee.last_name || ""}
                                                    </strong>
                                                </div>
                                            </td>

                                            <td>
                                                {employee.employee_code}
                                            </td>

                                            <td>
                                                {employee.phone || "-"}
                                            </td>

                                            <td>
                                                {employee.department_name || "-"}
                                            </td>

                                            <td>
                                                {employee.designation_name || "-"}
                                            </td>

                                            <td>
                                                <span
                                                    className={`status-badge ${employee.status?.toLowerCase()
                                                        }`}
                                                >
                                                    {employee.status ||
                                                        "ACTIVE"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            {/* ADD EMPLOYEE MODAL */}

            {showModal && (
                <div
                    className="modal-overlay"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            handleCloseModal();
                        }
                    }}
                >
                    <div className="employee-modal">

                        <div className="modal-header">
                            <div>
                                <h2>Add Employee</h2>
                                <p>Create a new employee profile</p>
                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                onClick={handleCloseModal}
                                disabled={saving}
                                aria-label="Close"
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

                                <div className="form-group">
                                    <label>
                                        Employee Code *
                                    </label>

                                    <input
                                        type="text"
                                        name="employee_code"
                                        value={formData.employee_code}
                                        onChange={handleChange}
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
                                        value={formData.first_name}
                                        onChange={handleChange}
                                        placeholder="First name"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Last Name</label>

                                    <input
                                        type="text"
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleChange}
                                        placeholder="Last name"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Phone</label>

                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="Phone number"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Date of Birth</label>

                                    <input
                                        type="date"
                                        name="date_of_birth"
                                        value={formData.date_of_birth}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Joining Date</label>

                                    <input
                                        type="date"
                                        name="joining_date"
                                        value={formData.joining_date}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="form-group">
                                    <div className="form-group">
                                        <label>Department</label>

                                        <select
                                            name="department_id"
                                            value={formData.department_id}
                                            onChange={handleChange}
                                            disabled={loadingOptions}
                                        >
                                            <option value="">
                                                {loadingOptions
                                                    ? "Loading departments..."
                                                    : "Select Department"}
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
                                    </div>
                                </div>

                                <div className="form-group">
                                    <div className="form-group">
                                        <label>Designation</label>

                                        <select
                                            name="designation_id"
                                            value={formData.designation_id}
                                            onChange={handleChange}
                                            disabled={loadingOptions}
                                        >
                                            <option value="">
                                                {loadingOptions
                                                    ? "Loading designations..."
                                                    : "Select Designation"}
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
                                    </div>
                                </div>

                                <div className="form-group mb-2">
                                    <label>Manager</label>
                                    <select
                                        name="manager_id"
                                        value={formData.manager_id}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Manager</option>

                                        {employees.map((employee) => (
                                            <option
                                                key={employee.id}
                                                value={employee.id}
                                            >
                                                {employee.first_name} {employee.last_name || ""}
                                                {" "}({employee.employee_code})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group mb-2">
                                    <label>Employment Type</label>

                                    <select
                                        name="employment_type"
                                        value={formData.employment_type}
                                        onChange={handleChange}
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

                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={handleCloseModal}
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
                                        ? "Creating..."
                                        : "Create Employee"}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Employees;