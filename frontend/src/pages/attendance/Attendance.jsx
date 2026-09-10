import { useEffect, useState } from "react";
import api from "../../api/api";
import "./Attendance.css";

function Attendance() {
  const [attendance, setAttendance] = useState([]);

  const [summary, setSummary] = useState({
    total: 0,
    present: 0,
    absent: 0,
    half_day: 0,
    leave: 0,
  });

  const [pagination, setPagination] =
    useState({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });

  const [search, setSearch] =
    useState("");

  const [date, setDate] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
  |--------------------------------------------------------------------------
  | FETCH ATTENDANCE
  |--------------------------------------------------------------------------
  */

  const fetchAttendance = async (
    requestedPage = 1
  ) => {
    try {
      setLoading(true);
      setError("");

      const params = {
        page: requestedPage,
        limit: 20,
      };

      if (search.trim()) {
        params.search =
          search.trim();
      }

      if (date) {
        params.date = date;
      }

      if (status) {
        params.status = status;
      }

      const response =
        await api.get(
          "/attendance",
          { params }
        );

      const data =
        response.data;

      setAttendance(
        data.data || []
      );

      setSummary({
        total:
          data.summary?.total || 0,

        present:
          data.summary?.present || 0,

        absent:
          data.summary?.absent || 0,

        half_day:
          data.summary?.half_day || 0,

        leave:
          data.summary?.leave || 0,
      });

      setPagination(
        data.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        }
      );
    } catch (err) {
      console.error(
        "Attendance error:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Failed to fetch attendance"
      );

      setAttendance([]);

      setSummary({
        total: 0,
        present: 0,
        absent: 0,
        half_day: 0,
        leave: 0,
      });
    } finally {
      setLoading(false);
    }
  };


  /*
  |--------------------------------------------------------------------------
  | INITIAL LOAD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    fetchAttendance(1);
  }, []);


  /*
  |--------------------------------------------------------------------------
  | SEARCH DEBOUNCE
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const timer =
      setTimeout(() => {
        fetchAttendance(1);
      }, 400);

    return () =>
      clearTimeout(timer);
  }, [search]);


  /*
  |--------------------------------------------------------------------------
  | DATE / STATUS
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!date && !status) {
      return;
    }

    fetchAttendance(1);
  }, [date, status]);


  /*
  |--------------------------------------------------------------------------
  | CLEAR FILTERS
  |--------------------------------------------------------------------------
  */

  const clearFilters = () => {
    setSearch("");
    setDate("");
    setStatus("");

    fetchAttendance(1);
  };


  /*
  |--------------------------------------------------------------------------
  | CHECK IN
  |--------------------------------------------------------------------------
  */

  const handleCheckIn = async (
    employeeId
  ) => {
    if (!employeeId) {
      return;
    }

    try {
      await api.post(
        "/attendance/check-in",
        {
          employee_id:
            employeeId,
        }
      );

      await fetchAttendance(
        pagination.page
      );
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Unable to check in"
      );
    }
  };


  /*
  |--------------------------------------------------------------------------
  | CHECK OUT
  |--------------------------------------------------------------------------
  */

  const handleCheckOut = async (
    employeeId
  ) => {
    if (!employeeId) {
      return;
    }

    try {
      await api.post(
        "/attendance/check-out",
        {
          employee_id:
            employeeId,
        }
      );

      await fetchAttendance(
        pagination.page
      );
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Unable to check out"
      );
    }
  };


  /*
  |--------------------------------------------------------------------------
  | HELPERS
  |--------------------------------------------------------------------------
  */

  const getEmployeeName = (
    item
  ) => {
    const first =
      item.first_name || "";

    const last =
      item.last_name || "";

    return (
      `${first} ${last}`.trim() ||
      "Unknown Employee"
    );
  };


  const getInitials = (
    name
  ) => {
    if (!name) {
      return "U";
    }

    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (word) =>
          word[0]
      )
      .join("")
      .toUpperCase();
  };


  const formatStatus = (
    status
  ) => {
    if (!status) {
      return "-";
    }

    return status
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(
        /\b\w/g,
        (char) =>
          char.toUpperCase()
      );
  };


  const getStatusClass = (
    status
  ) => {
    switch (
      String(status || "")
        .toUpperCase()
    ) {
      case "PRESENT":
        return "present";

      case "ABSENT":
        return "absent";

      case "HALF_DAY":
        return "half-day";

      case "LEAVE":
        return "leave";

      default:
        return "";
    }
  };


  const formatDate = (
    value
  ) => {
    if (!value) {
      return "-";
    }

    const dateValue =
      new Date(value);

    if (
      Number.isNaN(
        dateValue.getTime()
      )
    ) {
      return value;
    }

    return dateValue.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };


  const formatTime = (
    value
  ) => {
    if (!value) {
      return "-";
    }

    const timeString =
      String(value)
        .split("T")
        .pop()
        .split(".")[0];

    const parts =
      timeString.split(":");

    if (parts.length < 2) {
      return value;
    }

    let hour =
      parseInt(
        parts[0],
        10
      );

    const minute =
      parts[1];

    const ampm =
      hour >= 12
        ? "PM"
        : "AM";

    hour =
      hour % 12 || 12;

    return `${hour}:${minute} ${ampm}`;
  };


  const formatWorkingHours = (
    minutes
  ) => {
    if (
      minutes === null ||
      minutes === undefined
    ) {
      return "-";
    }

    const totalMinutes =
      Number(minutes);

    if (
      Number.isNaN(
        totalMinutes
      )
    ) {
      return "-";
    }

    const hours =
      Math.floor(
        totalMinutes / 60
      );

    const mins =
      totalMinutes % 60;

    return `${hours}h ${mins}m`;
  };


  /*
  |--------------------------------------------------------------------------
  | PAGINATION
  |--------------------------------------------------------------------------
  */

  const goToPage = (
    page
  ) => {
    if (
      page < 1 ||
      page >
        pagination.totalPages
    ) {
      return;
    }

    fetchAttendance(page);
  };


  return (
    <div className="attendance-page">

      {/* HEADER */}

      <div className="attendance-page-header">

        <div>
          <h1>
            Attendance
          </h1>

          <p>
            Manage and track
            employee attendance
          </p>
        </div>

        <button
          className="attendance-refresh-button"
          onClick={() =>
            fetchAttendance(
              pagination.page
            )
          }
          disabled={loading}
        >
          <span
            className={
              loading
                ? "refresh-icon spinning"
                : "refresh-icon"
            }
          >
            ↻
          </span>

          Refresh
        </button>

      </div>


      {/* SUMMARY */}

      <div className="attendance-summary">

        <div className="attendance-summary-card">

          <div className="summary-icon total-icon">
            👥
          </div>

          <div>
            <span>
              Total Records
            </span>

            <strong>
              {summary.total}
            </strong>
          </div>

        </div>


        <div className="attendance-summary-card">

          <div className="summary-icon present-icon">
            ✓
          </div>

          <div>
            <span>
              Present
            </span>

            <strong>
              {summary.present}
            </strong>
          </div>

        </div>


        <div className="attendance-summary-card">

          <div className="summary-icon absent-icon">
            !
          </div>

          <div>
            <span>
              Absent
            </span>

            <strong>
              {summary.absent}
            </strong>
          </div>

        </div>


        <div className="attendance-summary-card">

          <div className="summary-icon leave-icon">
            📅
          </div>

          <div>
            <span>
              Leave
            </span>

            <strong>
              {summary.leave}
            </strong>
          </div>

        </div>

      </div>


      {/* FILTERS */}

      <div className="attendance-filters">

        <div className="attendance-filter-grid">

          {/* SEARCH */}

          <div className="attendance-filter-group">

            <label>
              Search Employee
            </label>

            <div className="attendance-search-wrapper">

              <span className="search-icon">
                ⌕
              </span>

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search by name or employee code"
              />

            </div>

          </div>


          {/* DATE */}

          <div className="attendance-filter-group">

            <label>
              Date
            </label>

            <input
              type="date"
              value={date}
              onChange={(e) =>
                setDate(
                  e.target.value
                )
              }
            />

          </div>


          {/* STATUS */}

          <div className="attendance-filter-group">

            <label>
              Status
            </label>

            <select
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value
                )
              }
            >
              <option value="">
                All Status
              </option>

              <option value="PRESENT">
                Present
              </option>

              <option value="ABSENT">
                Absent
              </option>

              <option value="HALF_DAY">
                Half Day
              </option>

              <option value="LEAVE">
                Leave
              </option>
            </select>

          </div>


          {/* CLEAR */}

          <button
            type="button"
            className="attendance-clear-btn"
            onClick={
              clearFilters
            }
          >
            Clear
          </button>

        </div>

      </div>


      {/* ERROR */}

      {error && (
        <div className="attendance-error">

          <span>
            !
          </span>

          {error}

        </div>
      )}


      {/* TABLE */}

      <div className="attendance-table-card">

        <div className="attendance-table-header">

          <div>
            <h2>
              Attendance Records
            </h2>

            <p>
              {pagination.total} record
              {pagination.total !== 1
                ? "s"
                : ""}{" "}
              found
            </p>
          </div>

        </div>


        {loading ? (

          <div className="attendance-loading">

            <div className="attendance-spinner" />

            <p>
              Loading attendance...
            </p>

          </div>

        ) : attendance.length === 0 ? (

          <div className="attendance-empty">

            <div className="empty-icon">
              📋
            </div>

            <h3>
              No attendance records
            </h3>

            <p>
              No attendance data found
              for the selected filters.
            </p>

          </div>

        ) : (

          <div className="attendance-table-wrapper">

            <table className="attendance-table">

              <thead>

                <tr>
                  <th>
                    Employee
                  </th>

                  <th>
                    Date
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Check In
                  </th>

                  <th>
                    Check Out
                  </th>

                  <th>
                    Working Hours
                  </th>

                  <th>
                    Action
                  </th>
                </tr>

              </thead>


              <tbody>

                {attendance.map(
                  (item) => {

                    const employeeName =
                      getEmployeeName(
                        item
                      );

                    const currentStatus =
                      String(
                        item.status ||
                          ""
                      ).toUpperCase();

                    return (
                      <tr
                        key={
                          item.id
                        }
                      >

                        {/* EMPLOYEE */}

                        <td>

                          <div className="employee-cell">

                            <div className="employee-avatar">
                              {getInitials(
                                employeeName
                              )}
                            </div>

                            <div>

                              <strong>
                                {
                                  employeeName
                                }
                              </strong>

                              <span>
                                {
                                  item.employee_code ||
                                  "-"
                                }
                              </span>

                            </div>

                          </div>

                        </td>


                        {/* DATE */}

                        <td className="table-date">
                          {formatDate(
                            item.attendance_date
                          )}
                        </td>


                        {/* STATUS */}

                        <td>

                          <span
                            className={`attendance-status ${getStatusClass(
                              currentStatus
                            )}`}
                          >
                            {formatStatus(
                              currentStatus
                            )}
                          </span>

                        </td>


                        {/* CHECK IN */}

                        <td className="time-value">
                          {formatTime(
                            item.check_in
                          )}
                        </td>


                        {/* CHECK OUT */}

                        <td className="time-value">
                          {formatTime(
                            item.check_out
                          )}
                        </td>


                        {/* WORKING HOURS */}

                        <td className="working-hours">
                          {formatWorkingHours(
                            item.working_minutes
                          )}
                        </td>


                        {/* ACTION */}

                        <td>

                          <div className="attendance-actions">

                            {!item.check_in && (
                              <button
                                className="check-in-button"
                                onClick={() =>
                                  handleCheckIn(
                                    item.employee_id
                                  )
                                }
                              >
                                Check In
                              </button>
                            )}


                            {item.check_in &&
                              !item.check_out && (
                                <button
                                  className="check-out-button"
                                  onClick={() =>
                                    handleCheckOut(
                                      item.employee_id
                                    )
                                  }
                                >
                                  Check Out
                                </button>
                              )}


                            {item.check_in &&
                              item.check_out && (
                                <span className="completed-label">
                                  Completed
                                </span>
                              )}

                          </div>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        )}


        {/* PAGINATION */}

        {!loading &&
          attendance.length > 0 && (
            <div className="attendance-pagination">

              <span>
                Page{" "}
                {pagination.page}{" "}
                of{" "}
                {pagination.totalPages ||
                  1}
              </span>

              <div className="pagination-buttons">

                <button
                  disabled={
                    pagination.page <= 1
                  }
                  onClick={() =>
                    goToPage(
                      pagination.page -
                        1
                    )
                  }
                >
                  Previous
                </button>

                <button
                  disabled={
                    pagination.page >=
                    pagination.totalPages
                  }
                  onClick={() =>
                    goToPage(
                      pagination.page +
                        1
                    )
                  }
                >
                  Next
                </button>

              </div>

            </div>
          )}

      </div>

    </div>
  );
}

export default Attendance;