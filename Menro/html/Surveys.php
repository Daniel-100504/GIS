<?php
require_once __DIR__ . '/../../Login/Database/session-init.php';
if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'menro') {
    header('Location: ../../Login/Login.php');
    exit;
}
?>
<div class="dashboard-header">
  <div class="dashboard-header-badge">
    <img src="../../assets/calatagan-seal.png" width="48" height="48" alt="Calatagan Seal">
  </div>
  <div>
    <h2 class="dashboard-page-title">Ranger Surveys</h2>
    <div class="dashboard-meta-row">
      <span>Review, approve, or request revisions on field survey submissions</span>
    </div>
  </div>
</div>

<div class="chart-card survey-log-panel">

  <div class="approval-tabs-row">
    <div class="approval-tabs">
      <button type="button" class="approval-tab active" data-surveys-tab="all">All <span class="approval-tab-count" id="surveysTabCountAll">0</span></button>
      <button type="button" class="approval-tab" data-surveys-tab="pending">Pending <span class="approval-tab-count" id="surveysTabCountPending">0</span></button>
      <button type="button" class="approval-tab" data-surveys-tab="approved">Approved <span class="approval-tab-count" id="surveysTabCountApproved">0</span></button>
      <button type="button" class="approval-tab" data-surveys-tab="rejected">Needs Revision <span class="approval-tab-count" id="surveysTabCountRejected">0</span></button>
    </div>
  </div>

  <div class="surveys-filter-bar">
    <div class="surveys-search-wrap">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="surveysSearch" class="surveys-search-input" placeholder="Search zone or ranger…" autocomplete="off" />
    </div>

    <select id="surveysFilterBarangay" class="surveys-filter-select">
      <option value="">All barangays</option>
    </select>

    <select id="surveysFilterZone" class="surveys-filter-select">
      <option value="">All mangroves</option>
    </select>

    <select id="surveysFilterStatus" class="surveys-filter-select">
      <option value="">All status</option>
      <option value="pending">Pending</option>
      <option value="approved">Approved</option>
      <option value="rejected">Needs Revision</option>
    </select>

    <button type="button" id="surveysFilterClear" class="surveys-filter-clear-btn">Clear</button>
  </div>

  <div class="survey-log-table-wrap">
    <table class="survey-log-table">
      <colgroup>
        <col style="width:11%;">
        <col style="width:27%;">
        <col style="width:16%;">
        <col style="width:18%;">
        <col style="width:14%;">
        <col style="width:14%;">
      </colgroup>
      <thead>
        <tr>
          <th data-sort-key="date"><button type="button" class="sort-th-btn">Date<span class="sort-arrow"></span></button></th>
          <th data-sort-key="zone"><button type="button" class="sort-th-btn">Zone<span class="sort-arrow"></span></button></th>
          <th data-sort-key="ranger"><button type="button" class="sort-th-btn">Ranger<span class="sort-arrow"></span></button></th>
          <th class="cell-center" data-sort-key="aquafarm"><button type="button" class="sort-th-btn">Aquafarm Nearby<span class="sort-arrow"></span></button></th>
          <th class="cell-center" data-sort-key="status"><button type="button" class="sort-th-btn">Status<span class="sort-arrow"></span></button></th>
          <th class="cell-center">Actions</th>
        </tr>
      </thead>
      <tbody id="surveysTableBody"></tbody>
    </table>
  </div>
  <div class="dashboard-empty" id="surveysEmpty" hidden>No submissions found.</div>
  <div class="table-pagination" id="surveysPagination" hidden>
    <span class="table-pagination-text" id="surveysPaginationText"></span>
    <div class="table-pagination-controls">
      <button type="button" class="table-pagination-btn" id="surveysPrevPage">Prev</button>
      <button type="button" class="table-pagination-btn" id="surveysNextPage">Next</button>
    </div>
  </div>
</div>
