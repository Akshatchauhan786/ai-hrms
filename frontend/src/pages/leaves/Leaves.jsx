import React, { useEffect, useMemo, useState } from "react";
import "./Leaves.css";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const Leaves = () => {
    const token = localStorage.getItem("token");

    const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    };

    const [activeTab, setActiveTab] = useState("requests");

    const [requests, setRequests] = useState([]);
    const [balances, setBalances] = useState([]);
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [employees, setEmployees] = useState([]);

    const [loading, setLoading] = useState(false);
    const [balanceLoading, setBalanceLoading] = useState(false);

    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");

    const [showApplyModal, setShowApplyModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [messageModal, setMessageModal] = useState({
        title: "",
        message: "",
        type: "success",
    });

    const [selectedRequest, setSelectedRequest] = useState(null);
    const [rejectReason, setRejectReason] = useState("");

    const [submitting, setSubmitting] = useState(false);

    const showMessage = (message, title = "Success", type = "success") => {
        setMessageModal({ title, message, type });
        setShowMessageModal(true);
    };

    const closeMessageModal = () => {
        setShowMessageModal(false);
    };

    const [page, setPage] = useState(1);

    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
    });

    const [form, setForm] = useState({
        employee_id: "",
        leave_type_id: "",
        start_date: "",
        end_date: "",
        reason: "",
    });

    const formatDate = (date) => {
        if (!date) return "-";

        const d = new Date(date);

        if (isNaN(d.getTime())) return "-";

        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();

        return `${day}-${month}-${year}`;
    };

    // ==========================================
    // FETCH EMPLOYEES
    // ==========================================

    const fetchEmployees = async () => {
        try {
            const response = await fetch(
                `${API_URL}/employees?limit=100`,
                {
                    headers,
                }
            );

            const result = await response.json();

            if (response.ok) {
                setEmployees(result.data || []);
            }
        } catch (error) {
            console.error("Fetch employees error:", error);
        }
    };

    // ==========================================
    // FETCH LEAVE TYPES
    // ==========================================

    const fetchLeaveTypes = async () => {
        try {
            const response = await fetch(
                `${API_URL}/leave-types`,
                {
                    headers,
                }
            );

            const result = await response.json();

            if (response.ok) {
                setLeaveTypes(result.data || []);
            }
        } catch (error) {
            console.error("Fetch leave types error:", error);
        }
    };

    // ==========================================
    // FETCH LEAVE REQUESTS
    // ==========================================

    const fetchRequests = async () => {
        try {
            setLoading(true);

            const params = new URLSearchParams();

            params.append("page", page);
            params.append("limit", "10");

            if (search.trim()) {
                params.append("search", search.trim());
            }

            if (status) {
                params.append("status", status);
            }

            const response = await fetch(
                `${API_URL}/leave-requests?${params.toString()}`,
                {
                    headers,
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to fetch leave requests"
                );
            }

            setRequests(result.data || []);

            setPagination(
                result.pagination || {
                    page,
                    limit: 10,
                    total: result.data?.length || 0,
                    totalPages: 1,
                }
            );
        } catch (error) {
            console.error("Fetch leave requests error:", error);
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // FETCH BALANCES
    // ==========================================

    const fetchBalances = async () => {
        try {
            setBalanceLoading(true);

            const response = await fetch(
                `${API_URL}/leave-balances`,
                {
                    headers,
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to fetch balances"
                );
            }

            setBalances(result.data || []);
        } catch (error) {
            console.error("Fetch balances error:", error);
        } finally {
            setBalanceLoading(false);
        }
    };

    // ==========================================
    // INITIAL LOAD
    // ==========================================

    useEffect(() => {
        fetchEmployees();
        fetchLeaveTypes();
        fetchBalances();
    }, []);

    // ==========================================
    // REQUEST LOAD
    // ==========================================

    useEffect(() => {
        fetchRequests();
    }, [page, status]);

    // ==========================================
    // SEARCH DEBOUNCE
    // ==========================================

    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchRequests();
        }, 400);

        return () => clearTimeout(timer);
    }, [search]);

    // ==========================================
    // FORM CHANGE
    // ==========================================

    const handleChange = (e) => {
        const { name, value } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // ==========================================
    // TOTAL DAYS
    // ==========================================

    const totalDays = useMemo(() => {
        if (!form.start_date || !form.end_date) {
            return 0;
        }

        const start = new Date(form.start_date);
        const end = new Date(form.end_date);

        if (end < start) {
            return 0;
        }

        const difference =
            end.getTime() - start.getTime();

        return (
            Math.floor(
                difference / (1000 * 60 * 60 * 24)
            ) + 1
        );
    }, [form.start_date, form.end_date]);

    // ==========================================
    // APPLY LEAVE
    // ==========================================

    const handleApplyLeave = async (e) => {
        e.preventDefault();

        if (!form.employee_id) {
            showMessage("Please select employee", "Validation Error", "error");
            return;
        }

        if (!form.leave_type_id) {
            showMessage("Please select leave type", "Validation Error", "error");
            return;
        }

        if (!form.start_date || !form.end_date) {
            showMessage("Please select leave dates", "Validation Error", "error");
            return;
        }

        if (totalDays <= 0) {
            showMessage("Invalid leave dates", "Validation Error", "error");
            return;
        }

        try {
            setSubmitting(true);

            const response = await fetch(
                `${API_URL}/leave-requests`,
                {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        employee_id: Number(form.employee_id),
                        leave_type_id: Number(form.leave_type_id),
                        start_date: form.start_date,
                        end_date: form.end_date,
                        reason: form.reason.trim(),
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to apply leave"
                );
            }

            showMessage("Leave request submitted successfully", "Leave Applied", "success");

            setShowApplyModal(false);

            resetForm();

            fetchRequests();
            fetchBalances();
        } catch (error) {
            console.error("Apply leave error:", error);
            showMessage(error.message || "Something went wrong", "Error", "error");
        } finally {
            setSubmitting(false);
        }
    };

    // ==========================================
    // APPROVE LEAVE
    // ==========================================

    const handleApprove = (request) => {
        setSelectedRequest(request);
        setConfirmAction("approve");
        setShowConfirmModal(true);
    };

    const confirmApproveLeave = async () => {
        if (!selectedRequest) return;

        try {
            setSubmitting(true);

            const response = await fetch(
                `${API_URL}/leave-requests/${selectedRequest.id}/approve`,
                {
                    method: "PATCH",
                    headers,
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to approve leave"
                );
            }

            setShowConfirmModal(false);
            setConfirmAction(null);
            setSelectedRequest(null);

            showMessage(
                "Leave approved successfully",
                "Leave Approved",
                "success"
            );

            fetchRequests();
            fetchBalances();
        } catch (error) {
            console.error("Approve leave error:", error);
            setShowConfirmModal(false);
            setConfirmAction(null);
            showMessage(
                error.message || "Failed to approve leave",
                "Error",
                "error"
            );
        } finally {
            setSubmitting(false);
        }
    };

    // ==========================================
    // OPEN REJECT MODAL
    // ==========================================

    const openRejectModal = (request) => {
        setSelectedRequest(request);
        setRejectReason("");
        setShowRejectModal(true);
    };

    // ==========================================
    // REJECT LEAVE
    // ==========================================

    const handleReject = async (e) => {
        e.preventDefault();

        if (!rejectReason.trim()) {
            showMessage("Please enter rejection reason", "Validation Error", "error");
            return;
        }

        try {
            setSubmitting(true);

            const response = await fetch(
                `${API_URL}/leave-requests/${selectedRequest.id}/reject`,
                {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({
                        rejection_reason: rejectReason.trim(),
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to reject leave"
                );
            }

            showMessage("Leave rejected successfully", "Leave Rejected", "success");

            setShowRejectModal(false);
            setSelectedRequest(null);
            setRejectReason("");

            fetchRequests();
        } catch (error) {
            console.error("Reject leave error:", error);
            showMessage(error.message || "Something went wrong", "Error", "error");
        } finally {
            setSubmitting(false);
        }
    };

    // ==========================================
    // RESET FORM
    // ==========================================

    const resetForm = () => {
        setForm({
            employee_id: "",
            leave_type_id: "",
            start_date: "",
            end_date: "",
            reason: "",
        });
    };

    // ==========================================
    // CLEAR FILTERS
    // ==========================================

    const clearFilters = () => {
        setSearch("");
        setStatus("");
        setPage(1);
    };

    // ==========================================
    // VIEW REQUEST
    // ==========================================

    const openViewModal = (request) => {
        setSelectedRequest(request);
        setShowViewModal(true);
    };

    // ==========================================
    // STATUS CLASS
    // ==========================================

    const getStatusClass = (value) => {
        switch (value) {
            case "APPROVED":
                return "leave-status approved";

            case "REJECTED":
                return "leave-status rejected";

            case "PENDING":
                return "leave-status pending";

            case "CANCELLED":
                return "leave-status cancelled";

            default:
                return "leave-status";
        }
    };

    return (
        <div className="leaves-page">

            {/* ======================================
          HEADER
      ====================================== */}

            <div className="leaves-header">
                <div>
                    <h1>Leaves</h1>
                    <p>
                        Manage employee leave requests and balances
                    </p>
                </div>

                <button
                    className="primary-btn"
                    onClick={() => {
                        resetForm();
                        setShowApplyModal(true);
                    }}
                >
                    + Apply Leave
                </button>
            </div>

            {/* ======================================
          TABS
      ====================================== */}

            <div className="leave-tabs">
                <button
                    className={
                        activeTab === "requests"
                            ? "leave-tab active"
                            : "leave-tab"
                    }
                    onClick={() => setActiveTab("requests")}
                >
                    Leave Requests
                </button>

                <button
                    className={
                        activeTab === "balance"
                            ? "leave-tab active"
                            : "leave-tab"
                    }
                    onClick={() => setActiveTab("balance")}
                >
                    Leave Balance
                </button>

                <button
                    className={
                        activeTab === "types"
                            ? "leave-tab active"
                            : "leave-tab"
                    }
                    onClick={() => setActiveTab("types")}
                >
                    Leave Types
                </button>
            </div>

            {/* ======================================
          REQUESTS
      ====================================== */}

            {activeTab === "requests" && (
                <>
                    <div className="leave-filter-card">

                        <div className="leave-filter-field search-field">
                            <label>Search Employee</label>

                            <div className="leave-search-wrapper">
                                <span>⌕</span>

                                <input
                                    type="text"
                                    placeholder="Search employee..."
                                    value={search}
                                    onChange={(e) =>
                                        setSearch(e.target.value)
                                    }
                                />

                                {search && (
                                    <button
                                        className="search-clear"
                                        onClick={() => setSearch("")}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="leave-filter-field">
                            <label>Status</label>

                            <select
                                value={status}
                                onChange={(e) => {
                                    setStatus(e.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="">All Status</option>
                                <option value="PENDING">
                                    Pending
                                </option>
                                <option value="APPROVED">
                                    Approved
                                </option>
                                <option value="REJECTED">
                                    Rejected
                                </option>
                                <option value="CANCELLED">
                                    Cancelled
                                </option>
                            </select>
                        </div>

                        <div className="leave-filter-actions">
                            <button
                                className="secondary-btn"
                                onClick={clearFilters}
                            >
                                Clear
                            </button>
                        </div>

                    </div>

                    <div className="leave-table-card">

                        <div className="table-responsive">

                            <table className="leave-table">

                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Leave Type</th>
                                        <th>From</th>
                                        <th>To</th>
                                        <th>Days</th>
                                        <th>Reason</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>

                                <tbody>

                                    {loading ? (
                                        <tr>
                                            <td
                                                colSpan="8"
                                                className="table-message"
                                            >
                                                Loading...
                                            </td>
                                        </tr>
                                    ) : requests.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="8"
                                                className="table-message"
                                            >
                                                No leave requests found
                                            </td>
                                        </tr>
                                    ) : (
                                        requests.map((request) => (
                                            <tr key={request.id}>

                                                <td>
                                                    <div className="employee-name">
                                                        {request.first_name}{" "}
                                                        {request.last_name || ""}
                                                    </div>

                                                    <small>
                                                        {request.employee_code}
                                                    </small>
                                                </td>

                                                <td>
                                                    {request.leave_type_name ||
                                                        request.leave_type ||
                                                        "-"}
                                                </td>

                                                <td>
                                                    {formatDate(request.start_date)}
                                                </td>

                                                <td>
                                                    {formatDate(request.end_date)}
                                                </td>

                                                <td>
                                                    {request.total_days || 0}
                                                </td>

                                                <td className="reason-cell">
                                                    {request.reason || "-"}
                                                </td>

                                                <td>
                                                    <span
                                                        className={getStatusClass(
                                                            request.status
                                                        )}
                                                    >
                                                        {request.status}
                                                    </span>
                                                </td>

                                                <td>

                                                    <div className="leave-actions">

                                                        <button
                                                            className="view-btn"
                                                            onClick={() =>
                                                                openViewModal(request)
                                                            }
                                                        >
                                                            View
                                                        </button>

                                                        {request.status ===
                                                            "PENDING" && (
                                                                <>
                                                                    <button
                                                                        className="approve-btn"
                                                                        onClick={() =>
                                                                            handleApprove(request)
                                                                        }
                                                                        disabled={submitting}
                                                                    >
                                                                        Approve
                                                                    </button>

                                                                    <button
                                                                        className="reject-btn"
                                                                        onClick={() =>
                                                                            openRejectModal(
                                                                                request
                                                                            )
                                                                        }
                                                                        disabled={submitting}
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                </>
                                                            )}

                                                    </div>

                                                </td>

                                            </tr>
                                        ))
                                    )}

                                </tbody>

                            </table>

                        </div>

                        {/* PAGINATION */}

                        {pagination.totalPages > 1 && (
                            <div className="leave-pagination">

                                <button
                                    disabled={page <= 1}
                                    onClick={() =>
                                        setPage((prev) => prev - 1)
                                    }
                                >
                                    Previous
                                </button>

                                <span>
                                    Page {page} of{" "}
                                    {pagination.totalPages}
                                </span>

                                <button
                                    disabled={
                                        page >= pagination.totalPages
                                    }
                                    onClick={() =>
                                        setPage((prev) => prev + 1)
                                    }
                                >
                                    Next
                                </button>

                            </div>
                        )}

                    </div>
                </>
            )}

            {/* ======================================
          BALANCE
      ====================================== */}

            {activeTab === "balance" && (
                <div className="leave-table-card">

                    <div className="section-heading">
                        <div>
                            <h2>Leave Balance</h2>
                            <p>
                                Employee-wise leave allocation
                            </p>
                        </div>
                    </div>

                    <div className="table-responsive">

                        <table className="leave-table">

                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Leave Type</th>
                                    <th>Year</th>
                                    <th>Allocated</th>
                                    <th>Used</th>
                                    <th>Remaining</th>
                                </tr>
                            </thead>

                            <tbody>

                                {balanceLoading ? (
                                    <tr>
                                        <td
                                            colSpan="6"
                                            className="table-message"
                                        >
                                            Loading...
                                        </td>
                                    </tr>
                                ) : balances.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="6"
                                            className="table-message"
                                        >
                                            No leave balances found
                                        </td>
                                    </tr>
                                ) : (
                                    balances.map((balance) => (
                                        <tr key={balance.id}>

                                            <td>
                                                <div className="employee-name">
                                                    {balance.first_name}{" "}
                                                    {balance.last_name || ""}
                                                </div>

                                                <small>
                                                    {balance.employee_code}
                                                </small>
                                            </td>

                                            <td>
                                                {balance.leave_type_name}
                                            </td>

                                            <td>{balance.year}</td>

                                            <td>
                                                {balance.allocated_days}
                                            </td>

                                            <td>
                                                {balance.used_days}
                                            </td>

                                            <td>
                                                <strong className="remaining-days">
                                                    {balance.remaining_days}
                                                </strong>
                                            </td>

                                        </tr>
                                    ))
                                )}

                            </tbody>

                        </table>

                    </div>

                </div>
            )}

            {/* ======================================
          LEAVE TYPES
      ====================================== */}

            {activeTab === "types" && (
                <div className="leave-table-card">

                    <div className="section-heading">
                        <div>
                            <h2>Leave Types</h2>
                            <p>
                                Available leave types in your organization
                            </p>
                        </div>
                    </div>

                    <div className="table-responsive">

                        <table className="leave-table">

                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Description</th>
                                    <th>Days / Year</th>
                                    <th>Status</th>
                                </tr>
                            </thead>

                            <tbody>

                                {leaveTypes.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="4"
                                            className="table-message"
                                        >
                                            No leave types found
                                        </td>
                                    </tr>
                                ) : (
                                    leaveTypes.map((type) => (
                                        <tr key={type.id}>

                                            <td>
                                                <strong>
                                                    {type.name}
                                                </strong>
                                            </td>

                                            <td>
                                                {type.description || "-"}
                                            </td>

                                            <td>
                                                {type.days_per_year}
                                            </td>

                                            <td>
                                                <span
                                                    className={
                                                        type.status === "ACTIVE"
                                                            ? "leave-status approved"
                                                            : "leave-status rejected"
                                                    }
                                                >
                                                    {type.status}
                                                </span>
                                            </td>

                                        </tr>
                                    ))
                                )}

                            </tbody>

                        </table>

                    </div>

                </div>
            )}

            {/* ======================================
          APPLY LEAVE MODAL
      ====================================== */}

            {showApplyModal && (
                <div
                    className="leave-modal-overlay"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowApplyModal(false);
                        }
                    }}
                >

                    <div className="leave-modal">

                        <div className="leave-modal-header">
                            <div>
                                <h2>Apply Leave</h2>
                                <p>
                                    Create a new employee leave request
                                </p>
                            </div>

                            <button
                                className="modal-close"
                                onClick={() =>
                                    setShowApplyModal(false)
                                }
                            >
                                ×
                            </button>
                        </div>

                        <form
                            className="leave-form"
                            onSubmit={handleApplyLeave}
                        >

                            <div className="form-grid">

                                <div className="form-group">
                                    <label>
                                        Employee <span>*</span>
                                    </label>

                                    <select
                                        name="employee_id"
                                        value={form.employee_id}
                                        onChange={handleChange}
                                    >
                                        <option value="">
                                            Select employee
                                        </option>

                                        {employees.map((employee) => (
                                            <option
                                                key={employee.id}
                                                value={employee.id}
                                            >
                                                {employee.first_name}{" "}
                                                {employee.last_name || ""}{" "}
                                                ({employee.employee_code})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>
                                        Leave Type <span>*</span>
                                    </label>

                                    <select
                                        name="leave_type_id"
                                        value={form.leave_type_id}
                                        onChange={handleChange}
                                    >
                                        <option value="">
                                            Select leave type
                                        </option>

                                        {leaveTypes
                                            .filter(
                                                (type) =>
                                                    type.status === "ACTIVE"
                                            )
                                            .map((type) => (
                                                <option
                                                    key={type.id}
                                                    value={type.id}
                                                >
                                                    {type.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>
                                        From Date <span>*</span>
                                    </label>

                                    <input
                                        type="date"
                                        name="start_date"
                                        value={form.start_date}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>
                                        To Date <span>*</span>
                                    </label>

                                    <input
                                        type="date"
                                        name="end_date"
                                        value={form.end_date}
                                        min={form.start_date || undefined}
                                        onChange={handleChange}
                                    />
                                </div>

                            </div>

                            <div className="days-preview">
                                <span>Total Leave Days</span>

                                <strong>
                                    {totalDays}
                                </strong>
                            </div>

                            <div className="form-group full-width">
                                <label>Reason</label>

                                <textarea
                                    name="reason"
                                    rows="4"
                                    placeholder="Enter leave reason..."
                                    value={form.reason}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="modal-footer">

                                <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => {
                                        resetForm();
                                        setShowApplyModal(false);
                                    }}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="primary-btn"
                                    disabled={submitting}
                                >
                                    {submitting
                                        ? "Submitting..."
                                        : "Submit Leave"}
                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}

            {/* ======================================
          VIEW MODAL
      ====================================== */}

            {showViewModal && selectedRequest && (
                <div
                    className="leave-modal-overlay"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowViewModal(false);
                        }
                    }}
                >

                    <div className="leave-modal">

                        <div className="leave-modal-header">

                            <div>
                                <h2>Leave Details</h2>
                                <p>
                                    Request #{selectedRequest.id}
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

                        <div className="leave-details">

                            <div className="detail-item">
                                <span>Employee</span>
                                <strong>
                                    {selectedRequest.first_name}{" "}
                                    {selectedRequest.last_name || ""}
                                </strong>
                            </div>

                            <div className="detail-item">
                                <span>Employee Code</span>
                                <strong>
                                    {selectedRequest.employee_code ||
                                        "-"}
                                </strong>
                            </div>

                            <div className="detail-item">
                                <span>Leave Type</span>
                                <strong>
                                    {selectedRequest.leave_type_name ||
                                        "-"}
                                </strong>
                            </div>

                            <div className="detail-item">
                                <span>Status</span>
                                <strong>
                                    {selectedRequest.status}
                                </strong>
                            </div>
                            <div className="detail-item">
                                <span>From Date</span>
                                <strong>
                                     {formatDate(selectedRequest.start_date)}
                                </strong>
                            </div>

                            <div className="detail-item">
                                <span>To Date</span>
                                <strong>
                                    {formatDate(selectedRequest.end_date)}
                                </strong>
                            </div>

                            <div className="detail-item">
                                <span>Total Days</span>
                                <strong>
                                    {selectedRequest.total_days ||
                                        "-"}
                                </strong>
                            </div>

                            <div className="detail-item full">
                                <span>Reason</span>
                                <p>
                                    {selectedRequest.reason ||
                                        "No reason provided"}
                                </p>
                            </div>

                            {selectedRequest.rejection_reason && (
                                <div className="detail-item full">
                                    <span>Rejection Reason</span>
                                    <p className="rejection-text">
                                        {selectedRequest.rejection_reason}
                                    </p>
                                </div>
                            )}

                        </div>

                        <div className="modal-footer">

                            {selectedRequest.status ===
                                "PENDING" && (
                                    <>
                                        <button
                                            className="reject-btn"
                                            onClick={() => {
                                                setShowViewModal(false);
                                                openRejectModal(
                                                    selectedRequest
                                                );
                                            }}
                                        >
                                            Reject
                                        </button>

                                        <button
                                            className="approve-btn"
                                            onClick={() => {
                                                setShowViewModal(false);
                                                handleApprove(selectedRequest);
                                            }}
                                        >
                                            Approve
                                        </button>
                                    </>
                                )}

                            <button
                                className="secondary-btn"
                                onClick={() =>
                                    setShowViewModal(false)
                                }
                            >
                                Close
                            </button>

                        </div>

                    </div>

                </div>
            )}

            {/* ======================================
          REJECT MODAL
      ====================================== */}

            {showRejectModal && selectedRequest && (
                <div
                    className="leave-modal-overlay"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowRejectModal(false);
                        }
                    }}
                >

                    <div className="leave-modal small-modal">

                        <div className="leave-modal-header">

                            <div>
                                <h2>Reject Leave</h2>
                                <p>
                                    Provide a reason for rejection
                                </p>
                            </div>

                            <button
                                className="modal-close"
                                onClick={() =>
                                    setShowRejectModal(false)
                                }
                            >
                                ×
                            </button>

                        </div>

                        <form
                            className="leave-form"
                            onSubmit={handleReject}
                        >

                            <div className="form-group">
                                <label>
                                    Rejection Reason <span>*</span>
                                </label>

                                <textarea
                                    rows="5"
                                    placeholder="Enter rejection reason..."
                                    value={rejectReason}
                                    onChange={(e) =>
                                        setRejectReason(e.target.value)
                                    }
                                />
                            </div>

                            <div className="modal-footer">

                                <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() =>
                                        setShowRejectModal(false)
                                    }
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="reject-btn"
                                    disabled={submitting}
                                >
                                    {submitting
                                        ? "Rejecting..."
                                        : "Reject Leave"}
                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}

            {/* ======================================
          APPROVE CONFIRMATION MODAL
      ====================================== */}

            {showConfirmModal &&
                confirmAction === "approve" &&
                selectedRequest && (
                    <div
                        className="leave-modal-overlay"
                        onMouseDown={(e) => {
                            if (e.target === e.currentTarget) {
                                setShowConfirmModal(false);
                                setConfirmAction(null);
                                setSelectedRequest(null);
                            }
                        }}
                    >
                        <div className="leave-modal small-modal">

                            <div className="leave-modal-header">
                                <div>
                                    <h2>Approve Leave</h2>
                                    <p>Confirm leave approval</p>
                                </div>

                                <button
                                    type="button"
                                    className="modal-close"
                                    onClick={() => {
                                        setShowConfirmModal(false);
                                        setConfirmAction(null);
                                        setSelectedRequest(null);
                                    }}
                                >
                                    ×
                                </button>
                            </div>

                            <div className="confirmation-content">
                                <div className="confirmation-icon success">
                                    ✓
                                </div>

                                <h3>Approve this leave request?</h3>

                                <p>
                                    You are about to approve the leave request for{" "}
                                    <strong>
                                        {selectedRequest.first_name}{" "}
                                        {selectedRequest.last_name || ""}
                                    </strong>.
                                </p>

                                <div className="confirmation-details">
                                    <div>
                                        <span>Leave Type</span>
                                        <strong>
                                            {selectedRequest.leave_type_name || "-"}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>From</span>
                                        <strong>
                                            {formatDate(selectedRequest.start_date)}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>To</span>
                                        <strong>
                                            {formatDate(selectedRequest.end_date)}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Total Days</span>
                                        <strong>
                                            {selectedRequest.total_days || 0}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="secondary-btn"
                                    disabled={submitting}
                                    onClick={() => {
                                        setShowConfirmModal(false);
                                        setConfirmAction(null);
                                        setSelectedRequest(null);
                                    }}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    className="approve-btn"
                                    disabled={submitting}
                                    onClick={confirmApproveLeave}
                                >
                                    {submitting ? "Approving..." : "Yes, Approve"}
                                </button>
                            </div>

                        </div>
                    </div>
                )}

            {/* ======================================
          SUCCESS / ERROR MESSAGE MODAL
      ====================================== */}

            {showMessageModal && (
                <div
                    className="leave-modal-overlay"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            closeMessageModal();
                        }
                    }}
                >
                    <div className="leave-modal small-modal">

                        <div className="leave-modal-header">
                            <div>
                                <h2>{messageModal.title}</h2>
                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                onClick={closeMessageModal}
                            >
                                ×
                            </button>
                        </div>

                        <div className="message-modal-content">
                            <div
                                className={`message-modal-icon ${messageModal.type}`}
                            >
                                {messageModal.type === "success" ? "✓" : "!"}
                            </div>

                            <p>{messageModal.message}</p>
                        </div>

                        <div className="modal-footer">
                            <button
                                type="button"
                                className="primary-btn"
                                onClick={closeMessageModal}
                            >
                                OK
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
};

export default Leaves;