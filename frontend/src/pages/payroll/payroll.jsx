import { useEffect, useMemo, useState } from "react";
import "./Payroll.css";

// If Vite proxy is configured, keep this as "/api".
// Otherwise change it to "http://localhost:5000/api"
const API_URL = "/api";

const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
});

// ------------------------------------
// SAFE API RESPONSE HANDLER
// ------------------------------------
const parseResponse = async (response) => {
    const contentType =
        response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        const text = await response.text();

        console.error("Non JSON API response:", text);

        throw new Error(
            `API returned ${response.status} non-JSON response. Check backend URL/proxy.`
        );
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.message || "Something went wrong"
        );
    }

    return result;
};

// ------------------------------------
// DATE FORMAT
// ------------------------------------
const formatDate = (date) => {
    if (!date) return "-";

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) return date;

    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
};

// ------------------------------------
// CURRENCY
// ------------------------------------
const formatCurrency = (value) => {
    const amount = Number(value) || 0;

    return `₹${amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

// ------------------------------------
// STATUS CLASS
// ------------------------------------
const getStatusClass = (status) => {
    switch (status) {
        case "PAID":
            return "payroll-status paid";

        case "APPROVED":
            return "payroll-status approved";

        case "PROCESSED":
            return "payroll-status processed";

        default:
            return "payroll-status";
    }
};

// ------------------------------------
// MONTH NAME
// ------------------------------------
const getMonthName = (month) => {
    if (!month) return "-";

    const monthNumber = Number(month);

    if (monthNumber >= 1 && monthNumber <= 12) {
        return new Date(
            2000,
            monthNumber - 1,
            1
        ).toLocaleString("en-IN", {
            month: "long",
        });
    }

    return month;
};

// ====================================
// PAYROLL COMPONENT
// ====================================

function Payroll() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const [activeTab, setActiveTab] = useState("payroll");

    const [payrolls, setPayrolls] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [salaryStructures, setSalaryStructures] =
        useState([]);

    const [loading, setLoading] = useState(false);
    const [employeesLoading, setEmployeesLoading] =
        useState(false);
    const [salaryLoading, setSalaryLoading] =
        useState(false);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [monthFilter, setMonthFilter] = useState("");
    const [yearFilter, setYearFilter] = useState("");

    // ----------------------------------
    // MODALS
    // ----------------------------------

    const [showGenerateModal, setShowGenerateModal] =
        useState(false);

    const [showSalaryModal, setShowSalaryModal] =
        useState(false);

    const [showViewModal, setShowViewModal] =
        useState(false);

    const [showConfirmModal, setShowConfirmModal] =
        useState(false);

    const [showMessageModal, setShowMessageModal] =
        useState(false);

    const [selectedPayroll, setSelectedPayroll] =
        useState(null);

    const [confirmAction, setConfirmAction] =
        useState("");

    const [messageModal, setMessageModal] = useState({
        title: "",
        message: "",
        type: "success",
    });

    const [submitting, setSubmitting] = useState(false);

    // ----------------------------------
    // GENERATE FORM
    // ----------------------------------

    const [generateForm, setGenerateForm] = useState({
        employee_id: "",
        month: currentMonth,
        year: currentYear,
    });

    // ----------------------------------
    // SALARY FORM
    // ----------------------------------

    const [salaryForm, setSalaryForm] = useState({
        employee_id: "",
        basic_salary: "",
        hra: "",
        transport_allowance: "",
        medical_allowance: "",
        other_allowance: "",
        provident_fund: "",
        professional_tax: "",
        other_deduction: "",
        effective_from: new Date()
            .toISOString()
            .split("T")[0],
    });

    // ==================================
    // MESSAGE MODAL
    // ==================================

    const showMessage = (
        message,
        title = "Success",
        type = "success"
    ) => {
        setMessageModal({
            title,
            message,
            type,
        });

        setShowMessageModal(true);
    };

    const closeMessageModal = () => {
        setShowMessageModal(false);
    };

    // ==================================
    // FETCH EMPLOYEES
    // ==================================

    const fetchEmployees = async () => {
        try {
            setEmployeesLoading(true);

            const response = await fetch(
                `${API_URL}/employees?limit=100`,
                {
                    headers: getHeaders(),
                }
            );

            const result = await parseResponse(response);

            setEmployees(result.data || []);
        } catch (error) {
            console.error(
                "Fetch employees error:",
                error
            );

            showMessage(
                error.message ||
                "Failed to fetch employees",
                "Error",
                "error"
            );
        } finally {
            setEmployeesLoading(false);
        }
    };

    // ==================================
    // FETCH SALARY STRUCTURES
    // ==================================

    const fetchSalaryStructures = async () => {
        try {
            setSalaryLoading(true);

            const response = await fetch(
                `${API_URL}/salaries`,
                {
                    headers: getHeaders(),
                }
            );

            const result = await parseResponse(response);

            setSalaryStructures(result.data || []);
        } catch (error) {
            console.error(
                "Fetch salary structures error:",
                error
            );

            showMessage(
                error.message ||
                "Failed to fetch salary structures",
                "Error",
                "error"
            );
        } finally {
            setSalaryLoading(false);
        }
    };

    // ==================================
    // FETCH PAYROLLS
    // ==================================

    const fetchPayrolls = async () => {
        try {
            setLoading(true);

            const params = new URLSearchParams();

            if (monthFilter) {
                params.append(
                    "month",
                    monthFilter
                );
            }

            if (yearFilter) {
                params.append(
                    "year",
                    yearFilter
                );
            }

            if (statusFilter) {
                params.append(
                    "status",
                    statusFilter
                );
            }

            const query = params.toString();

            const url = `${API_URL}/payroll${query ? `?${query}` : ""
                }`;

            console.log("Fetching payroll:", url);

            const response = await fetch(url, {
                method: "GET",
                headers: getHeaders(),
            });

            const result = await parseResponse(response);

            setPayrolls(result.data || []);
        } catch (error) {
            console.error(
                "Fetch payroll error:",
                error
            );

            showMessage(
                error.message ||
                "Failed to fetch payroll",
                "Error",
                "error"
            );
        } finally {
            setLoading(false);
        }
    };

    // ==================================
    // INITIAL LOAD
    // ==================================

    useEffect(() => {
        fetchEmployees();
        fetchSalaryStructures();
    }, []);

    useEffect(() => {
        fetchPayrolls();
    }, [
        monthFilter,
        yearFilter,
        statusFilter,
    ]);

    // ==================================
    // FILTER PAYROLL
    // ==================================

    const filteredPayrolls = useMemo(() => {
        const value = search
            .trim()
            .toLowerCase();

        if (!value) {
            return payrolls;
        }

        return payrolls.filter((payroll) => {
            const employeeName =
                `${payroll.first_name || ""} ${payroll.last_name || ""
                    }`
                    .trim()
                    .toLowerCase();

            const employeeCode = String(
                payroll.employee_code || ""
            ).toLowerCase();

            return (
                employeeName.includes(value) ||
                employeeCode.includes(value)
            );
        });
    }, [payrolls, search]);

    // ==================================
    // PAYROLL STATS
    // ==================================

    const stats = useMemo(() => {
        const total = payrolls.length;

        const processed = payrolls.filter(
            (item) =>
                item.status === "PROCESSED"
        ).length;

        const approved = payrolls.filter(
            (item) =>
                item.status === "APPROVED"
        ).length;

        const paid = payrolls.filter(
            (item) =>
                item.status === "PAID"
        ).length;

        const totalNet = payrolls.reduce(
            (sum, item) =>
                sum +
                Number(item.net_salary || 0),
            0
        );

        return {
            total,
            processed,
            approved,
            paid,
            totalNet,
        };
    }, [payrolls]);

    // ==================================
    // SALARY TOTALS
    // ==================================

    const salaryTotals = useMemo(() => {
        const basic =
            Number(
                salaryForm.basic_salary
            ) || 0;

        const hra =
            Number(salaryForm.hra) || 0;

        const transport =
            Number(
                salaryForm.transport_allowance
            ) || 0;

        const medical =
            Number(
                salaryForm.medical_allowance
            ) || 0;

        const other =
            Number(
                salaryForm.other_allowance
            ) || 0;

        const pf =
            Number(
                salaryForm.provident_fund
            ) || 0;

        const professionalTax =
            Number(
                salaryForm.professional_tax
            ) || 0;

        const otherDeduction =
            Number(
                salaryForm.other_deduction
            ) || 0;

        const gross =
            basic +
            hra +
            transport +
            medical +
            other;

        const totalDeduction =
            pf +
            professionalTax +
            otherDeduction;

        const net =
            gross - totalDeduction;

        return {
            gross,
            totalDeduction,
            net,
        };
    }, [salaryForm]);

    // ==================================
    // RESET SALARY FORM
    // ==================================

    const resetSalaryForm = () => {
        setSalaryForm({
            employee_id: "",
            basic_salary: "",
            hra: "",
            transport_allowance: "",
            medical_allowance: "",
            other_allowance: "",
            provident_fund: "",
            professional_tax: "",
            other_deduction: "",
            effective_from: new Date()
                .toISOString()
                .split("T")[0],
        });
    };

    // ==================================
    // SALARY CHANGE
    // ==================================

    const handleSalaryChange = (e) => {
        const {
            name,
            value,
        } = e.target;

        setSalaryForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // ==================================
    // CREATE SALARY STRUCTURE
    // ==================================

    const createSalaryStructure =
        async (e) => {
            e.preventDefault();

            if (!salaryForm.employee_id) {
                showMessage(
                    "Please select an employee",
                    "Validation Error",
                    "error"
                );
                return;
            }

            if (!salaryForm.effective_from) {
                showMessage(
                    "Please select effective date",
                    "Validation Error",
                    "error"
                );
                return;
            }

            if (salaryTotals.net < 0) {
                showMessage(
                    "Total deductions cannot be greater than gross salary",
                    "Validation Error",
                    "error"
                );
                return;
            }

            try {
                setSubmitting(true);

                const response = await fetch(
                    `${API_URL}/salaries`,
                    {
                        method: "POST",
                        headers: getHeaders(),
                        body: JSON.stringify({
                            employee_id:
                                Number(
                                    salaryForm.employee_id
                                ),

                            basic_salary:
                                Number(
                                    salaryForm.basic_salary
                                ) || 0,

                            hra:
                                Number(
                                    salaryForm.hra
                                ) || 0,

                            transport_allowance:
                                Number(
                                    salaryForm.transport_allowance
                                ) || 0,

                            medical_allowance:
                                Number(
                                    salaryForm.medical_allowance
                                ) || 0,

                            other_allowance:
                                Number(
                                    salaryForm.other_allowance
                                ) || 0,

                            provident_fund:
                                Number(
                                    salaryForm.provident_fund
                                ) || 0,

                            professional_tax:
                                Number(
                                    salaryForm.professional_tax
                                ) || 0,

                            other_deduction:
                                Number(
                                    salaryForm.other_deduction
                                ) || 0,

                            effective_from:
                                salaryForm.effective_from,
                        }),
                    }
                );

                const result =
                    await parseResponse(response);

                setShowSalaryModal(false);

                resetSalaryForm();

                await fetchSalaryStructures();

                showMessage(
                    result.message ||
                    "Salary structure created successfully",
                    "Salary Structure",
                    "success"
                );
            } catch (error) {
                console.error(
                    "Create salary structure error:",
                    error
                );

                showMessage(
                    error.message ||
                    "Failed to create salary structure",
                    "Error",
                    "error"
                );
            } finally {
                setSubmitting(false);
            }
        };

    // ==================================
    // GENERATE PAYROLL
    // ==================================

    const generatePayroll = async (e) => {
        e.preventDefault();

        if (
            !generateForm.employee_id ||
            !generateForm.month ||
            !generateForm.year
        ) {
            showMessage(
                "Employee, month and year are required",
                "Validation Error",
                "error"
            );
            return;
        }

        try {
            setSubmitting(true);

            const response = await fetch(
                `${API_URL}/payroll/generate`,
                {
                    method: "POST",
                    headers: getHeaders(),
                    body: JSON.stringify({
                        employee_id: Number(
                            generateForm.employee_id
                        ),
                        month: Number(
                            generateForm.month
                        ),
                        year: Number(
                            generateForm.year
                        ),
                    }),
                }
            );

            const result = await parseResponse(response);

            setShowGenerateModal(false);

            setGenerateForm({
                employee_id: "",
                month: currentMonth,
                year: currentYear,
            });

            await fetchPayrolls();

            showMessage(
                result.message ||
                "Payroll generated successfully",
                "Payroll Generated",
                "success"
            );
        } catch (error) {
            console.error(
                "Generate payroll error:",
                error
            );

            showMessage(
                error.message ||
                "Failed to generate payroll",
                "Error",
                "error"
            );
        } finally {
            setSubmitting(false);
        }
    };

    // ==================================
    // VIEW PAYROLL
    // ==================================

    const fetchPayrollById =
        async (id) => {
            try {
                setSubmitting(true);

                const response = await fetch(
                    `${API_URL}/payroll/${id}`,
                    {
                        headers: getHeaders(),
                    }
                );

                const result =
                    await parseResponse(response);

                setSelectedPayroll(
                    result.data
                );

                setShowViewModal(true);
            } catch (error) {
                console.error(
                    "Fetch payroll details error:",
                    error
                );

                showMessage(
                    error.message ||
                    "Failed to fetch payroll details",
                    "Error",
                    "error"
                );
            } finally {
                setSubmitting(false);
            }
        };

    // ==================================
    // CONFIRM MODAL
    // ==================================

    const openConfirmModal = (
        payroll,
        action
    ) => {
        setSelectedPayroll(payroll);
        setConfirmAction(action);
        setShowConfirmModal(true);
    };

    const closeConfirmModal = () => {
        if (submitting) return;

        setShowConfirmModal(false);
        setConfirmAction("");
        setSelectedPayroll(null);
    };

    // ==================================
    // APPROVE / PAY
    // ==================================

    const executeConfirmAction =
        async () => {
            if (!selectedPayroll)
                return;

            let endpoint = "";
            let successMessage = "";

            if (
                confirmAction === "approve"
            ) {
                endpoint = `/payroll/${selectedPayroll.id}/approve`;

                successMessage =
                    "Payroll approved successfully";
            }

            if (
                confirmAction === "paid"
            ) {
                endpoint = `/payroll/${selectedPayroll.id}/pay`;

                successMessage =
                    "Payroll marked as paid successfully";
            }

            if (!endpoint) return;

            try {
                setSubmitting(true);

                const response =
                    await fetch(
                        `${API_URL}${endpoint}`,
                        {
                            method: "PATCH",
                            headers: getHeaders(),
                        }
                    );

                const result =
                    await parseResponse(response);

                setShowConfirmModal(false);
                setConfirmAction("");
                setSelectedPayroll(null);

                await fetchPayrolls();

                showMessage(
                    result.message ||
                    successMessage,
                    "Success",
                    "success"
                );
            } catch (error) {
                console.error(
                    "Payroll action error:",
                    error
                );

                setShowConfirmModal(false);

                showMessage(
                    error.message ||
                    "Payroll action failed",
                    "Error",
                    "error"
                );
            } finally {
                setSubmitting(false);
            }
        };

    // ==================================
    // DOWNLOAD PAYSLIP
    // ==================================

    const downloadPayslip =
        async (payroll) => {
            try {
                setSubmitting(true);

                const response =
                    await fetch(
                        `${API_URL}/payroll/${payroll.id}/payslip`,
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${localStorage.getItem(
                                        "token"
                                    )}`,
                            },
                        }
                    );

                if (!response.ok) {
                    let errorMessage =
                        "Failed to generate payslip";

                    const contentType =
                        response.headers.get(
                            "content-type"
                        ) || "";

                    if (
                        contentType.includes(
                            "application/json"
                        )
                    ) {
                        try {
                            const result =
                                await response.json();

                            errorMessage =
                                result.message ||
                                errorMessage;
                        } catch {
                            // Ignore
                        }
                    }

                    throw new Error(
                        errorMessage
                    );
                }

                const blob =
                    await response.blob();

                const url =
                    window.URL.createObjectURL(
                        blob
                    );

                const link =
                    document.createElement("a");

                link.href = url;

                link.download =
                    `Payslip-${payroll.employee_code ||
                    payroll.id
                    }-${payroll.month || ""
                    }-${payroll.year || ""
                    }.pdf`;

                document.body.appendChild(
                    link
                );

                link.click();

                link.remove();

                window.URL.revokeObjectURL(
                    url
                );
            } catch (error) {
                console.error(
                    "Payslip error:",
                    error
                );

                showMessage(
                    error.message ||
                    "Failed to generate payslip",
                    "Payslip Error",
                    "error"
                );
            } finally {
                setSubmitting(false);
            }
        };

    // ==================================
    // UI
    // ==================================

    return (
        <div className="payroll-page">

            {/* HEADER */}

            <div className="payroll-header">

                <div>
                    <h1>Payroll</h1>

                    <p>
                        Manage salary structures,
                        payroll and payslips
                    </p>
                </div>

                <div className="payroll-header-actions">

                    <button
                        className="payroll-btn secondary"
                        onClick={() =>
                            setShowSalaryModal(true)
                        }
                    >
                        + Salary Structure
                    </button>

                    <button
                        className="payroll-btn primary"
                        onClick={() =>
                            setShowGenerateModal(true)
                        }
                    >
                        Generate Payroll
                    </button>

                </div>

            </div>

            {/* STATS */}

            <div className="payroll-stats">

                <div className="payroll-stat-card">
                    <span>Total Payroll</span>
                    <strong>
                        {stats.total}
                    </strong>
                </div>

                <div className="payroll-stat-card">
                    <span>Processed</span>
                    <strong>
                        {stats.processed}
                    </strong>
                </div>

                <div className="payroll-stat-card">
                    <span>Approved</span>
                    <strong>
                        {stats.approved}
                    </strong>
                </div>

                <div className="payroll-stat-card">
                    <span>Paid</span>
                    <strong>
                        {stats.paid}
                    </strong>
                </div>

                <div className="payroll-stat-card">
                    <span>Total Net Salary</span>
                    <strong>
                        {formatCurrency(
                            stats.totalNet
                        )}
                    </strong>
                </div>

            </div>

            {/* TABS */}

            <div className="payroll-tabs">

                <button
                    className={
                        activeTab === "payroll"
                            ? "active"
                            : ""
                    }
                    onClick={() =>
                        setActiveTab("payroll")
                    }
                >
                    Payroll
                </button>

                <button
                    className={
                        activeTab === "salary"
                            ? "active"
                            : ""
                    }
                    onClick={() =>
                        setActiveTab("salary")
                    }
                >
                    Salary Structures
                </button>

            </div>

            {/* PAYROLL TAB */}

            {activeTab === "payroll" && (
                <>

                    <div className="payroll-filters">

                        <div className="payroll-search">
                            <input
                                type="text"
                                placeholder="Search employee..."
                                value={search}
                                onChange={(e) =>
                                    setSearch(
                                        e.target.value
                                    )
                                }
                            />
                        </div>

                        <select
                            value={monthFilter}
                            onChange={(e) =>
                                setMonthFilter(
                                    e.target.value
                                )
                            }
                        >
                            <option value="">
                                All Months
                            </option>

                            {Array.from(
                                { length: 12 },
                                (_, index) => (
                                    <option
                                        key={index + 1}
                                        value={index + 1}
                                    >
                                        {getMonthName(
                                            index + 1
                                        )}
                                    </option>
                                )
                            )}
                        </select>

                        <input
                            type="number"
                            placeholder="Year"
                            value={yearFilter}
                            onChange={(e) =>
                                setYearFilter(
                                    e.target.value
                                )
                            }
                        />

                        <select
                            value={statusFilter}
                            onChange={(e) =>
                                setStatusFilter(
                                    e.target.value
                                )
                            }
                        >
                            <option value="">
                                All Status
                            </option>

                            <option value="PROCESSED">
                                Processed
                            </option>

                            <option value="APPROVED">
                                Approved
                            </option>

                            <option value="PAID">
                                Paid
                            </option>
                        </select>

                        <button
                            className="payroll-btn clear"
                            onClick={() => {
                                setSearch("");
                                setMonthFilter("");
                                setYearFilter("");
                                setStatusFilter("");
                            }}
                        >
                            Clear
                        </button>

                    </div>

                    <div className="payroll-table-wrapper">

                        <table className="payroll-table">

                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Month</th>
                                    <th>Gross Salary</th>
                                    <th>Deductions</th>
                                    <th>Net Salary</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>

                                {loading ? (
                                    <tr>
                                        <td
                                            colSpan="7"
                                            className="empty-state"
                                        >
                                            Loading payroll...
                                        </td>
                                    </tr>
                                ) : filteredPayrolls.length ===
                                    0 ? (
                                    <tr>
                                        <td
                                            colSpan="7"
                                            className="empty-state"
                                        >
                                            No payroll records found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPayrolls.map(
                                        (payroll) => (
                                            <tr key={payroll.id}>

                                                <td>
                                                    <div className="employee-cell">
                                                        <strong>
                                                            {payroll.first_name}{" "}
                                                            {payroll.last_name}
                                                        </strong>

                                                        <small>
                                                            {payroll.employee_code ||
                                                                "-"}
                                                        </small>
                                                    </div>
                                                </td>

                                                <td>
                                                    {getMonthName(
                                                        payroll.month
                                                    )}{" "}
                                                    {payroll.year ||
                                                        ""}
                                                </td>

                                                <td>
                                                    {formatCurrency(
                                                        payroll.gross_salary
                                                    )}
                                                </td>

                                                <td>
                                                    {formatCurrency(
                                                        payroll.total_deduction
                                                    )}
                                                </td>

                                                <td>
                                                    <strong>
                                                        {formatCurrency(
                                                            payroll.net_salary
                                                        )}
                                                    </strong>
                                                </td>

                                                <td>
                                                    <span
                                                        className={getStatusClass(
                                                            payroll.status
                                                        )}
                                                    >
                                                        {payroll.status ||
                                                            "-"}
                                                    </span>
                                                </td>

                                                <td>

                                                    <div className="payroll-actions">

                                                        <button
                                                            className="action-btn view"
                                                            onClick={() =>
                                                                fetchPayrollById(
                                                                    payroll.id
                                                                )
                                                            }
                                                            disabled={
                                                                submitting
                                                            }
                                                        >
                                                            View
                                                        </button>

                                                        {payroll.status ===
                                                            "PROCESSED" && (
                                                                <button
                                                                    className="action-btn approve"
                                                                    onClick={() =>
                                                                        openConfirmModal(
                                                                            payroll,
                                                                            "approve"
                                                                        )
                                                                    }
                                                                >
                                                                    Approve
                                                                </button>
                                                            )}

                                                        {payroll.status ===
                                                            "APPROVED" && (
                                                                <button
                                                                    className="action-btn paid"
                                                                    onClick={() =>
                                                                        openConfirmModal(
                                                                            payroll,
                                                                            "paid"
                                                                        )
                                                                    }
                                                                >
                                                                    Mark Paid
                                                                </button>
                                                            )}

                                                        <button
                                                            className="action-btn payslip"
                                                            onClick={() =>
                                                                downloadPayslip(
                                                                    payroll
                                                                )
                                                            }
                                                            disabled={
                                                                submitting
                                                            }
                                                        >
                                                            Payslip
                                                        </button>

                                                    </div>

                                                </td>

                                            </tr>
                                        )
                                    )
                                )}

                            </tbody>

                        </table>

                    </div>

                </>
            )}

            {/* SALARY STRUCTURES */}

            {activeTab === "salary" && (
                <div className="payroll-table-wrapper">

                    <table className="payroll-table">

                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Basic</th>
                                <th>HRA</th>
                                <th>Gross</th>
                                <th>Deduction</th>
                                <th>Net</th>
                                <th>Effective From</th>
                                <th>Status</th>
                            </tr>
                        </thead>

                        <tbody>

                            {salaryLoading ? (
                                <tr>
                                    <td
                                        colSpan="8"
                                        className="empty-state"
                                    >
                                        Loading salary structures...
                                    </td>
                                </tr>
                            ) : salaryStructures.length ===
                                0 ? (
                                <tr>
                                    <td
                                        colSpan="8"
                                        className="empty-state"
                                    >
                                        No salary structures found
                                    </td>
                                </tr>
                            ) : (
                                salaryStructures.map(
                                    (salary) => (
                                        <tr key={salary.id}>

                                            <td>
                                                <div className="employee-cell">
                                                    <strong>
                                                        {salary.first_name}{" "}
                                                        {salary.last_name}
                                                    </strong>

                                                    <small>
                                                        {salary.employee_code ||
                                                            "-"}
                                                    </small>
                                                </div>
                                            </td>

                                            <td>
                                                {formatCurrency(
                                                    salary.basic_salary
                                                )}
                                            </td>

                                            <td>
                                                {formatCurrency(
                                                    salary.hra
                                                )}
                                            </td>

                                            <td>
                                                {formatCurrency(
                                                    salary.gross_salary
                                                )}
                                            </td>

                                            <td>
                                                {formatCurrency(
                                                    salary.total_deduction
                                                )}
                                            </td>

                                            <td>
                                                <strong>
                                                    {formatCurrency(
                                                        salary.net_salary
                                                    )}
                                                </strong>
                                            </td>

                                            <td>
                                                {formatDate(
                                                    salary.effective_from
                                                )}
                                            </td>

                                            <td>
                                                <span
                                                    className={getStatusClass(
                                                        salary.status
                                                    )}
                                                >
                                                    {salary.status ||
                                                        "-"}
                                                </span>
                                            </td>

                                        </tr>
                                    )
                                )
                            )}

                        </tbody>

                    </table>

                </div>
            )}

            {/* ==================================
          GENERATE PAYROLL MODAL
          ================================== */}

            {showGenerateModal && (
                <div
                    className="payroll-modal-overlay"
                    onClick={() => {
                        if (!submitting) {
                            setShowGenerateModal(false);
                        }
                    }}
                >

                    <div
                        className="payroll-modal"
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >

                        <div className="payroll-modal-header">

                            <div>
                                <h2>
                                    Generate Payroll
                                </h2>

                                <p>
                                    Generate payroll for selected month
                                </p>
                            </div>

                            <button
                                className="modal-close"
                                onClick={() =>
                                    !submitting &&
                                    setShowGenerateModal(false)
                                }
                            >
                                ×
                            </button>

                        </div>

                        <form
                            onSubmit={generatePayroll}
                            className="payroll-modal-form"
                        >
                            <div className="form-group">
                                <label>Employee</label>

                                <select
                                    value={generateForm.employee_id}
                                    onChange={(e) =>
                                        setGenerateForm((prev) => ({
                                            ...prev,
                                            employee_id: e.target.value,
                                        }))
                                    }
                                    required
                                >
                                    <option value="">
                                        Select Employee
                                    </option>

                                    {employees.map((employee) => (
                                        <option
                                            key={employee.id}
                                            value={employee.id}
                                        >
                                            {employee.employee_code} -{" "}
                                            {employee.first_name}{" "}
                                            {employee.last_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>
                                    Month
                                </label>

                                <select
                                    value={
                                        generateForm.month
                                    }
                                    onChange={(e) =>
                                        setGenerateForm(
                                            (prev) => ({
                                                ...prev,
                                                month:
                                                    e.target.value,
                                            })
                                        )
                                    }
                                >
                                    {Array.from(
                                        { length: 12 },
                                        (_, index) => (
                                            <option
                                                key={index + 1}
                                                value={
                                                    index + 1
                                                }
                                            >
                                                {getMonthName(
                                                    index + 1
                                                )}
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>
                                    Year
                                </label>

                                <input
                                    type="number"
                                    value={
                                        generateForm.year
                                    }
                                    onChange={(e) =>
                                        setGenerateForm(
                                            (prev) => ({
                                                ...prev,
                                                year:
                                                    e.target.value,
                                            })
                                        )
                                    }
                                />
                            </div>

                            <div className="modal-actions">

                                <button
                                    type="button"
                                    className="payroll-btn secondary"
                                    onClick={() =>
                                        setShowGenerateModal(
                                            false
                                        )
                                    }
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="payroll-btn primary"
                                    disabled={submitting}
                                >
                                    {submitting
                                        ? "Generating..."
                                        : "Generate Payroll"}
                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}

            {/* ==================================
          SALARY STRUCTURE MODAL
          ================================== */}

            {showSalaryModal && (
                <div
                    className="payroll-modal-overlay"
                    onClick={() => {
                        if (!submitting) {
                            setShowSalaryModal(false);
                        }
                    }}
                >

                    <div
                        className="payroll-modal large"
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >

                        <div className="payroll-modal-header">

                            <div>
                                <h2>
                                    Create Salary Structure
                                </h2>

                                <p>
                                    Add employee salary details
                                </p>
                            </div>

                            <button
                                className="modal-close"
                                onClick={() =>
                                    !submitting &&
                                    setShowSalaryModal(false)
                                }
                            >
                                ×
                            </button>

                        </div>

                        <form
                            onSubmit={
                                createSalaryStructure
                            }
                            className="payroll-modal-form"
                        >

                            <div className="form-grid">

                                <div className="form-group full">
                                    <label>
                                        Employee
                                    </label>

                                    <select
                                        name="employee_id"
                                        value={
                                            salaryForm.employee_id
                                        }
                                        onChange={
                                            handleSalaryChange
                                        }
                                        required
                                    >
                                        <option value="">
                                            Select Employee
                                        </option>

                                        {employees.map(
                                            (employee) => (
                                                <option
                                                    key={employee.id}
                                                    value={
                                                        employee.id
                                                    }
                                                >
                                                    {
                                                        employee.employee_code
                                                    }{" "}
                                                    -{" "}
                                                    {
                                                        employee.first_name
                                                    }{" "}
                                                    {
                                                        employee.last_name
                                                    }
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>

                                <div className="form-section-title">
                                    Earnings
                                </div>

                                <div className="form-group">
                                    <label>
                                        Basic Salary
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        name="basic_salary"
                                        value={
                                            salaryForm.basic_salary
                                        }
                                        onChange={
                                            handleSalaryChange
                                        }
                                    />
                                </div>

                                <div className="form-group">
                                    <label>HRA</label>

                                    <input
                                        type="number"
                                        min="0"
                                        name="hra"
                                        value={
                                            salaryForm.hra
                                        }
                                        onChange={
                                            handleSalaryChange
                                        }
                                    />
                                </div>

                                <div className="form-group">
                                    <label>
                                        Transport Allowance
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        name="transport_allowance"
                                        value={
                                            salaryForm.transport_allowance
                                        }
                                        onChange={
                                            handleSalaryChange
                                        }
                                    />
                                </div>

                                <div className="form-group">
                                    <label>
                                        Medical Allowance
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        name="medical_allowance"
                                        value={
                                            salaryForm.medical_allowance
                                        }
                                        onChange={
                                            handleSalaryChange
                                        }
                                    />
                                </div>

                                <div className="form-group">
                                    <label>
                                        Other Allowance
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        name="other_allowance"
                                        value={
                                            salaryForm.other_allowance
                                        }
                                        onChange={
                                            handleSalaryChange
                                        }
                                    />
                                </div>

                                <div className="form-section-title">
                                    Deductions
                                </div>

                                <div className="form-group">
                                    <label>
                                        Provident Fund
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        name="provident_fund"
                                        value={
                                            salaryForm.provident_fund
                                        }
                                        onChange={
                                            handleSalaryChange
                                        }
                                    />
                                </div>

                                <div className="form-group">
                                    <label>
                                        Professional Tax
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        name="professional_tax"
                                        value={
                                            salaryForm.professional_tax
                                        }
                                        onChange={
                                            handleSalaryChange
                                        }
                                    />
                                </div>

                                <div className="form-group">
                                    <label>
                                        Other Deduction
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        name="other_deduction"
                                        value={
                                            salaryForm.other_deduction
                                        }
                                        onChange={
                                            handleSalaryChange
                                        }
                                    />
                                </div>

                                <div className="form-group">
                                    <label>
                                        Effective From
                                    </label>

                                    <input
                                        type="date"
                                        name="effective_from"
                                        value={
                                            salaryForm.effective_from
                                        }
                                        onChange={
                                            handleSalaryChange
                                        }
                                        required
                                    />
                                </div>

                            </div>

                            {/* TOTALS */}

                            <div className="salary-summary">

                                <div>
                                    <span>
                                        Gross Salary
                                    </span>

                                    <strong>
                                        {formatCurrency(
                                            salaryTotals.gross
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Total Deduction
                                    </span>

                                    <strong>
                                        {formatCurrency(
                                            salaryTotals.totalDeduction
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Net Salary
                                    </span>

                                    <strong>
                                        {formatCurrency(
                                            salaryTotals.net
                                        )}
                                    </strong>
                                </div>

                            </div>

                            <div className="modal-actions">

                                <button
                                    type="button"
                                    className="payroll-btn secondary"
                                    onClick={() =>
                                        setShowSalaryModal(
                                            false
                                        )
                                    }
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="payroll-btn primary"
                                    disabled={submitting}
                                >
                                    {submitting
                                        ? "Saving..."
                                        : "Create Structure"}
                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}

            {/* ==================================
          VIEW PAYROLL MODAL
          ================================== */}

            {showViewModal &&
                selectedPayroll && (
                    <div
                        className="payroll-modal-overlay"
                        onClick={() =>
                            setShowViewModal(false)
                        }
                    >

                        <div
                            className="payroll-modal large"
                            onClick={(e) =>
                                e.stopPropagation()
                            }
                        >

                            <div className="payroll-modal-header">

                                <div>
                                    <h2>
                                        Payroll Details
                                    </h2>

                                    <p>
                                        {
                                            selectedPayroll.first_name
                                        }{" "}
                                        {
                                            selectedPayroll.last_name
                                        }
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

                            <div className="payroll-details-grid">

                                <div>
                                    <span>
                                        Employee Code
                                    </span>

                                    <strong>
                                        {
                                            selectedPayroll.employee_code ||
                                            "-"
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Payroll Period
                                    </span>

                                    <strong>
                                        {getMonthName(
                                            selectedPayroll.month
                                        )}{" "}
                                        {
                                            selectedPayroll.year ||
                                            ""
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Gross Salary
                                    </span>

                                    <strong>
                                        {formatCurrency(
                                            selectedPayroll.gross_salary
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Total Deduction
                                    </span>

                                    <strong>
                                        {formatCurrency(
                                            selectedPayroll.total_deduction
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Net Salary
                                    </span>

                                    <strong>
                                        {formatCurrency(
                                            selectedPayroll.net_salary
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Status
                                    </span>

                                    <strong>
                                        <span
                                            className={getStatusClass(
                                                selectedPayroll.status
                                            )}
                                        >
                                            {
                                                selectedPayroll.status ||
                                                "-"
                                            }
                                        </span>
                                    </strong>
                                </div>

                            </div>

                            <div className="modal-actions">

                                <button
                                    className="payroll-btn secondary"
                                    onClick={() =>
                                        setShowViewModal(
                                            false
                                        )
                                    }
                                >
                                    Close
                                </button>

                                <button
                                    className="payroll-btn primary"
                                    onClick={() =>
                                        downloadPayslip(
                                            selectedPayroll
                                        )
                                    }
                                >
                                    Download Payslip
                                </button>

                            </div>

                        </div>

                    </div>
                )}

            {/* ==================================
          CONFIRM MODAL
          ================================== */}

            {showConfirmModal &&
                selectedPayroll && (
                    <div
                        className="payroll-modal-overlay"
                        onClick={() => {
                            if (!submitting) {
                                closeConfirmModal();
                            }
                        }}
                    >

                        <div
                            className="payroll-modal confirm"
                            onClick={(e) =>
                                e.stopPropagation()
                            }
                        >

                            <div className="confirm-icon">
                                !
                            </div>

                            <h2>
                                {confirmAction ===
                                    "approve"
                                    ? "Approve Payroll?"
                                    : "Mark Payroll as Paid?"}
                            </h2>

                            <p>
                                Are you sure you want to{" "}
                                {confirmAction ===
                                    "approve"
                                    ? "approve"
                                    : "mark this payroll as paid"}{" "}
                                for{" "}
                                <strong>
                                    {
                                        selectedPayroll.first_name
                                    }{" "}
                                    {
                                        selectedPayroll.last_name
                                    }
                                </strong>
                                ?
                            </p>

                            <div className="modal-actions">

                                <button
                                    type="button"
                                    className="payroll-btn secondary"
                                    onClick={
                                        closeConfirmModal
                                    }
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    className="payroll-btn primary"
                                    onClick={
                                        executeConfirmAction
                                    }
                                    disabled={submitting}
                                >
                                    {submitting
                                        ? "Processing..."
                                        : "Confirm"}
                                </button>

                            </div>

                        </div>

                    </div>
                )}

            {/* ==================================
          MESSAGE MODAL
          ================================== */}

            {showMessageModal && (
                <div
                    className="payroll-modal-overlay"
                    onClick={
                        closeMessageModal
                    }
                >

                    <div
                        className="payroll-modal message"
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >

                        <div
                            className={`message-icon ${messageModal.type}`}
                        >
                            {messageModal.type ===
                                "error"
                                ? "!"
                                : "✓"}
                        </div>

                        <h2>
                            {messageModal.title}
                        </h2>

                        <p>
                            {messageModal.message}
                        </p>

                        <div className="modal-actions">

                            <button
                                className="payroll-btn primary"
                                onClick={
                                    closeMessageModal
                                }
                            >
                                OK
                            </button>

                        </div>

                    </div>

                </div>
            )}

        </div>
    );
}

export default Payroll;