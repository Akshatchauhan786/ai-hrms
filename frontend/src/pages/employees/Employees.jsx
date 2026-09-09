import { useEffect, useState } from "react";
import api from "../../api/api";

function Employees() {
  const [employees, setEmployees] = useState([]);

  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [managers, setManagers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingFormData, setLoadingFormData] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const emptyForm = {
    id: null,
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
  };

  const [formData, setFormData] = useState(emptyForm);

  // =========================================================
  // FETCH EMPLOYEES
  // =========================================================

  const fetchEmployees = async (page = pagination.page) => {
    try {
      setLoading(true);
      setError("");

      const params = {
        page,
        limit: pagination.limit,
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

      const response = await api.get("/employees", { params });

      if (response.data.success) {
        setEmployees(response.data.data || []);
        setPagination(response.data.pagination);
      } else {
        setError(response.data.message || "Failed to fetch employees");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to fetch employees"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // FETCH FORM DATA
  // =========================================================

  const fetchFormData = async () => {
    try {
      setLoadingFormData(true);

      const [departmentResponse, designationResponse, employeeResponse] =
        await Promise.all([
          api.get("/departments"),
          api.get("/designations"),
          api.get("/employees", {
            params: {
              page: 1,
              limit: 100,
              status: "ACTIVE",
            },
          }),
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

      setManagers(
        employeeResponse.data.data || []
      );
    } catch (err) {
      console.error("Form data error:", err);

      setError(
        err.response?.data?.message ||
          "Failed to load department/designation data"
      );
    } finally {
      setLoadingFormData(false);
    }
  };

  useEffect(() => {
    fetchEmployees(1);
  }, [status, departmentId, designationId]);

  useEffect(() => {
    fetchFormData();
  }, []);

  // =========================================================
  // SEARCH
  // =========================================================

  const handleSearch = (e) => {
    e.preventDefault();

    fetchEmployees(1);
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setDepartmentId("");
    setDesignationId("");

    setTimeout(() => {
      fetchEmployees(1);
    }, 0);
  };

  // =========================================================
  // FORM
  // =========================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =========================================================
  // OPEN ADD
  // =========================================================

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData(emptyForm);
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  // =========================================================
  // OPEN EDIT
  // =========================================================

  const openEditModal = async (employee) => {
    try {
      setError("");
      setSuccess("");

      const response = await api.get(
        `/employees/${employee.id}`
      );

      const data = response.data.data;

      setEditingEmployee(data);

      setFormData({
        id: data.id,
        employee_code: data.employee_code || "",
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        phone: data.phone || "",
        date_of_birth: formatDateForInput(data.date_of_birth),
        department_id: data.department_id || "",
        designation_id: data.designation_id || "",
        manager_id: data.manager_id || "",
        joining_date: formatDateForInput(data.joining_date),
        employment_type:
          data.employment_type || "FULL_TIME",
        status: data.status || "ACTIVE",
      });

      setShowModal(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load employee"
      );
    }
  };

  // =========================================================
  // VIEW EMPLOYEE
  // =========================================================

  const openViewModal = async (employee) => {
    try {
      setError("");

      const response = await api.get(
        `/employees/${employee.id}`
      );

      setSelectedEmployee(response.data.data);
      setShowViewModal(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load employee"
      );
    }
  };

  // =========================================================
  // SAVE EMPLOYEE
  // =========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!formData.employee_code.trim()) {
        setError("Employee code is required");
        return;
      }

      if (!formData.first_name.trim()) {
        setError("First name is required");
        return;
      }

      if (
        formData.manager_id &&
        Number(formData.manager_id) === Number(formData.id)
      ) {
        setError(
          "Employee cannot be their own manager"
        );
        return;
      }

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
          formData.employment_type || "FULL_TIME",
        status:
          formData.status || "ACTIVE",
      };

      let response;

      if (editingEmployee) {
        response = await api.put(
          `/employees/${editingEmployee.id}`,
          payload
        );
      } else {
        response = await api.post(
          "/employees",
          payload
        );
      }

      if (response.data.success) {
        setSuccess(
          editingEmployee
            ? "Employee updated successfully"
            : "Employee created successfully"
        );

        setShowModal(false);
        setEditingEmployee(null);
        setFormData(emptyForm);

        await fetchEmployees(
          editingEmployee
            ? pagination.page
            : 1
        );

        await fetchFormData();
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to save employee"
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // DEACTIVATE EMPLOYEE
  // =========================================================

  const handleDeactivate = async (employee) => {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate ${employee.first_name} ${employee.last_name || ""}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(employee.id);
      setError("");
      setSuccess("");

      const response = await api.delete(
        `/employees/${employee.id}`
      );

      if (response.data.success) {
        setSuccess(
          "Employee deactivated successfully"
        );

        await fetchEmployees(
          pagination.page
        );

        await fetchFormData();
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to deactivate employee"
      );
    } finally {
      setDeletingId(null);
    }
  };

  // =========================================================
  // PAGINATION
  // =========================================================

  const goToPage = (page) => {
    if (
      page < 1 ||
      page > pagination.totalPages ||
      page === pagination.page
    ) {
      return;
    }

    fetchEmployees(page);
  };

  // =========================================================
  // HELPERS
  // =========================================================

  const formatDateForInput = (date) => {
    if (!date) return "";

    return String(date).split("T")[0];
  };

  const formatDate = (date) => {
    if (!date) return "-";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getFullName = (employee) => {
    return `${employee.first_name || ""} ${
      employee.last_name || ""
    }`.trim();
  };

  const getStatusClass = (employeeStatus) => {
    return employeeStatus === "ACTIVE"
      ? "status-badge active"
      : "status-badge inactive";
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="employees-page">

      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <h1>Employees</h1>
          <p>
            Manage your organization's employees.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openAddModal}
        >
          + Add Employee
        </button>
      </div>

      {/* ALERTS */}
      {error && (
        <div className="alert alert-error">
          <span>⚠</span>
          <span>{error}</span>

          <button
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span>✓</span>
          <span>{success}</span>

          <button
            onClick={() => setSuccess("")}
          >
            ×
          </button>
        </div>
      )}

      {/* FILTER CARD */}
      <div className="employee-filter-card">

        <form
          className="employee-filters"
          onSubmit={handleSearch}
        >
          <div className="search-wrapper">
            <span className="search-icon">
              🔍
            </span>

            <input
              type="text"
              placeholder="Search by name or employee code..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </div>

          <select
            value={departmentId}
            onChange={(e) =>
              setDepartmentId(e.target.value)
            }
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
            type="submit"
            className="filter-button"
          >
            Search
          </button>

          <button
            type="button"
            className="clear-filter-button"
            onClick={clearFilters}
          >
            Clear
          </button>
        </form>

      </div>

      {/* EMPLOYEE TABLE */}
      <div className="employee-card">

        <div className="employee-card-header">
          <div>
            <h2>All Employees</h2>

            <span>
              {pagination.total} employee
              {pagination.total !== 1
                ? "s"
                : ""}
            </span>
          </div>

          <button
            className="refresh-button"
            onClick={() =>
              fetchEmployees(
                pagination.page
              )
            }
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="table-state">
            <div className="spinner"></div>
            <p>Loading employees...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="table-state empty-state">
            <div className="empty-icon">
              👥
            </div>

            <h3>No employees found</h3>

            <p>
              Try changing your filters or add a
              new employee.
            </p>

            <button
              className="primary-button"
              onClick={openAddModal}
            >
              + Add Employee
            </button>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="employees-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Code</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Joining Date</th>
                    <th>Employment</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id}>

                      <td>
                        <div className="employee-cell">
                          <div className="employee-avatar">
                            {employee.first_name
                              ?.charAt(0)
                              ?.toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {getFullName(employee)}
                            </strong>

                            <span>
                              {employee.phone ||
                                "No phone"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="employee-code">
                          {employee.employee_code}
                        </span>
                      </td>

                      <td>
                        {employee.department_name ||
                          "-"}
                      </td>

                      <td>
                        {employee.designation_name ||
                          "-"}
                      </td>

                      <td>
                        {formatDate(
                          employee.joining_date
                        )}
                      </td>

                      <td>
                        {formatEmploymentType(
                          employee.employment_type
                        )}
                      </td>

                      <td>
                        <span
                          className={getStatusClass(
                            employee.status
                          )}
                        >
                          {employee.status}
                        </span>
                      </td>

                      <td>
                        <div className="action-buttons">

                          <button
                            className="icon-action view"
                            title="View Employee"
                            onClick={() =>
                              openViewModal(
                                employee
                              )
                            }
                          >
                            👁
                          </button>

                          <button
                            className="icon-action edit"
                            title="Edit Employee"
                            onClick={() =>
                              openEditModal(
                                employee
                              )
                            }
                          >
                            ✏
                          </button>

                          {employee.status ===
                            "ACTIVE" && (
                            <button
                              className="icon-action delete"
                              title="Deactivate Employee"
                              onClick={() =>
                                handleDeactivate(
                                  employee
                                )
                              }
                              disabled={
                                deletingId ===
                                employee.id
                              }
                            >
                              {deletingId ===
                              employee.id
                                ? "..."
                                : "🗑"}
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="pagination">

              <div className="pagination-info">
                Showing{" "}
                {pagination.total === 0
                  ? 0
                  : (pagination.page - 1) *
                      pagination.limit +
                    1}{" "}
                -
                {Math.min(
                  pagination.page *
                    pagination.limit,
                  pagination.total
                )}{" "}
                of {pagination.total}
              </div>

              <div className="pagination-buttons">

                <button
                  disabled={
                    pagination.page === 1
                  }
                  onClick={() =>
                    goToPage(
                      pagination.page - 1
                    )
                  }
                >
                  ←
                </button>

                {getPageNumbers(
                  pagination.page,
                  pagination.totalPages
                ).map((page, index) =>
                  page === "..." ? (
                    <span
                      key={`dots-${index}`}
                      className="pagination-dots"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      className={
                        pagination.page === page
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        goToPage(page)
                      }
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  disabled={
                    pagination.page ===
                    pagination.totalPages
                  }
                  onClick={() =>
                    goToPage(
                      pagination.page + 1
                    )
                  }
                >
                  →
                </button>

              </div>
            </div>
          </>
        )}
      </div>

      {/* =====================================================
          ADD / EDIT MODAL
      ===================================================== */}

      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !saving
            ) {
              setShowModal(false);
            }
          }}
        >
          <div className="employee-modal">

            <div className="modal-header">
              <div>
                <h2>
                  {editingEmployee
                    ? "Edit Employee"
                    : "Add Employee"}
                </h2>

                <p>
                  {editingEmployee
                    ? "Update employee information"
                    : "Create a new employee profile"}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setShowModal(false)
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

              <div className="form-grid">

                <FormField
                  label="Employee Code"
                  required
                >
                  <input
                    type="text"
                    name="employee_code"
                    value={
                      formData.employee_code
                    }
                    onChange={handleChange}
                    placeholder="EMP001"
                    required
                  />
                </FormField>

                <FormField
                  label="First Name"
                  required
                >
                  <input
                    type="text"
                    name="first_name"
                    value={
                      formData.first_name
                    }
                    onChange={handleChange}
                    placeholder="First name"
                    required
                  />
                </FormField>

                <FormField label="Last Name">
                  <input
                    type="text"
                    name="last_name"
                    value={
                      formData.last_name
                    }
                    onChange={handleChange}
                    placeholder="Last name"
                  />
                </FormField>

                <FormField label="Phone">
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="9876543210"
                  />
                </FormField>

                <FormField label="Date of Birth">
                  <input
                    type="date"
                    name="date_of_birth"
                    value={
                      formData.date_of_birth
                    }
                    onChange={handleChange}
                  />
                </FormField>

                <FormField label="Joining Date">
                  <input
                    type="date"
                    name="joining_date"
                    value={
                      formData.joining_date
                    }
                    onChange={handleChange}
                  />
                </FormField>

                <FormField label="Department">
                  <select
                    name="department_id"
                    value={
                      formData.department_id
                    }
                    onChange={handleChange}
                    disabled={
                      loadingFormData
                    }
                  >
                    <option value="">
                      Select Department
                    </option>

                    {departments.map(
                      (department) => (
                        <option
                          key={department.id}
                          value={department.id}
                        >
                          {department.name}
                        </option>
                      )
                    )}
                  </select>
                </FormField>

                <FormField label="Designation">
                  <select
                    name="designation_id"
                    value={
                      formData.designation_id
                    }
                    onChange={handleChange}
                    disabled={
                      loadingFormData
                    }
                  >
                    <option value="">
                      Select Designation
                    </option>

                    {designations.map(
                      (designation) => (
                        <option
                          key={designation.id}
                          value={designation.id}
                        >
                          {designation.name}
                        </option>
                      )
                    )}
                  </select>
                </FormField>

                <FormField label="Manager">
                  <select
                    name="manager_id"
                    value={
                      formData.manager_id
                    }
                    onChange={handleChange}
                    disabled={
                      loadingFormData
                    }
                  >
                    <option value="">
                      No Manager
                    </option>

                    {managers
                      .filter(
                        (manager) =>
                          Number(manager.id) !==
                          Number(formData.id)
                      )
                      .map((manager) => (
                        <option
                          key={manager.id}
                          value={manager.id}
                        >
                          {getFullName(
                            manager
                          )}{" "}
                          (
                          {
                            manager.employee_code
                          }
                          )
                        </option>
                      ))}
                  </select>
                </FormField>

                <FormField label="Employment Type">
                  <select
                    name="employment_type"
                    value={
                      formData.employment_type
                    }
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

                    <option value="TEMPORARY">
                      Temporary
                    </option>
                  </select>
                </FormField>

                {editingEmployee && (
                  <FormField label="Status">
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                    >
                      <option value="ACTIVE">
                        Active
                      </option>

                      <option value="INACTIVE">
                        Inactive
                      </option>
                    </select>
                  </FormField>
                )}

              </div>

              <div className="modal-footer">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setShowModal(false)
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
                    ? "Saving..."
                    : editingEmployee
                    ? "Update Employee"
                    : "Create Employee"}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          VIEW MODAL
      ===================================================== */}

      {showViewModal &&
        selectedEmployee && (
          <div
            className="modal-overlay"
            onMouseDown={(e) => {
              if (
                e.target === e.currentTarget
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
                    Employee profile information
                  </p>
                </div>

                <button
                  className="modal-close"
                  onClick={() =>
                    setShowViewModal(false)
                  }
                >
                  ×
                </button>
              </div>

              <div className="employee-view-content">

                <div className="employee-profile-header">

                  <div className="large-avatar">
                    {selectedEmployee.first_name
                      ?.charAt(0)
                      ?.toUpperCase()}
                  </div>

                  <div>
                    <h3>
                      {getFullName(
                        selectedEmployee
                      )}
                    </h3>

                    <p>
                      {
                        selectedEmployee.employee_code
                      }
                    </p>

                    <span
                      className={getStatusClass(
                        selectedEmployee.status
                      )}
                    >
                      {
                        selectedEmployee.status
                      }
                    </span>
                  </div>

                </div>

                <div className="employee-detail-grid">

                  <DetailItem
                    label="Employee Code"
                    value={
                      selectedEmployee.employee_code
                    }
                  />

                  <DetailItem
                    label="Phone"
                    value={
                      selectedEmployee.phone
                    }
                  />

                  <DetailItem
                    label="Department"
                    value={
                      selectedEmployee.department_name
                    }
                  />

                  <DetailItem
                    label="Designation"
                    value={
                      selectedEmployee.designation_name
                    }
                  />

                  <DetailItem
                    label="Manager"
                    value={
                      selectedEmployee.manager_name
                    }
                  />

                  <DetailItem
                    label="Date of Birth"
                    value={formatDate(
                      selectedEmployee.date_of_birth
                    )}
                  />

                  <DetailItem
                    label="Joining Date"
                    value={formatDate(
                      selectedEmployee.joining_date
                    )}
                  />

                  <DetailItem
                    label="Employment Type"
                    value={formatEmploymentType(
                      selectedEmployee.employment_type
                    )}
                  />

                </div>

              </div>

              <div className="modal-footer">

                <button
                  className="secondary-button"
                  onClick={() =>
                    setShowViewModal(false)
                  }
                >
                  Close
                </button>

                <button
                  className="primary-button"
                  onClick={() => {
                    setShowViewModal(false);

                    openEditModal(
                      selectedEmployee
                    );
                  }}
                >
                  ✏ Edit Employee
                </button>

              </div>

            </div>
          </div>
        )}

    </div>
  );
}

// =========================================================
// SMALL COMPONENTS
// =========================================================

function FormField({
  label,
  required,
  children,
}) {
  return (
    <div className="form-group">
      <label>
        {label}

        {required && (
          <span className="required-star">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>

      <strong>
        {value || "-"}
      </strong>
    </div>
  );
}

// =========================================================
// HELPERS
// =========================================================

function formatEmploymentType(type) {
  if (!type) return "-";

  return type
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function getPageNumbers(
  currentPage,
  totalPages
) {
  if (totalPages <= 7) {
    return Array.from(
      { length: totalPages },
      (_, index) => index + 1
    );
  }

  if (currentPage <= 4) {
    return [
      1,
      2,
      3,
      4,
      5,
      "...",
      totalPages,
    ];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

export default Employees;