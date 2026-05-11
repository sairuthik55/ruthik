// =================== Firebase + Firestore ===================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// ===== Firebase Configuration =====
const firebaseConfig = {
  apiKey: "AIzaSyDBZHkJOqXCvjneip5d0H97NvPOFOMH0w0",
  authDomain: "library-3917b.firebaseapp.com",
  projectId: "library-3917b",
  storageBucket: "library-3917b.appspot.com",
  messagingSenderId: "32797695653",
  appId: "1:32797695653:web:5b69685d25132dc797374c",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== Helpers =====
const $ = (id) => document.getElementById(id);
const showAlert = (msg) => alert(msg);

function hideAll() {
 [
  "home",
  "login",
  "dashboard",
  "adminBooks",
  "userPage",
  "borrowRequests",
  "borrowedBooksPage"
]
  .forEach(
    (id) => {
      const el = $(id);
      if (el) el.style.display = "none";
    }
  );
}

let booksData = [];
let currentUser = "Guest User"; // placeholder for user system
let borrowedBooksData = [];
let activeBorrows = []; // track up to 5 active borrows

// ===== Real-time Books =====
onSnapshot(query(collection(db, "books"), orderBy("title")), (snap) => {
  booksData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderAdminBooks();
  renderUserBooks();
  populateCategoryFilter();
});

// ===== Admin Books =====
function renderAdminBooks() {
  const list = $("adminBookList");
  if (!list) return;
  list.innerHTML = "";
  booksData.forEach((b) => {
    const div = document.createElement("div");
    div.className = "book";
    div.innerHTML = `
      <img src="${b.image || "https://via.placeholder.com/300x420?text=Book"}" class="book-img">
      <h4>${b.title}</h4>
      <p>${b.author}</p>
      <p class="book-category">${b.category}</p>
      <button class="delete-btn">Delete</button>
    `;
    div.querySelector(".delete-btn").onclick = async () => {
      await deleteDoc(doc(db, "books", b.id));
      showAlert("Book deleted");
    };
    list.appendChild(div);
  });
}

// ===== Check User Borrow Status =====
function checkUserBorrowedStatus() {
  activeBorrows = []; // reset first
  const q = query(collection(db, "borrowedBooks"), orderBy("timestamp", "desc"));
  onSnapshot(q, (snap) => {

  borrowedBooksData = [];
    const now = new Date();
    activeBorrows = [];

    snap.forEach((docSnap) => {
      const b = docSnap.data();
      if (b.userName === currentUser && b.status === "approved") {
        const borrowDate = new Date(b.timestamp);
        const dueDate = new Date(borrowDate);
        dueDate.setDate(dueDate.getDate() + (b.borrowDays || 0));
        if (now < dueDate) {
          activeBorrows.push({ ...b, dueDate });
        }
      }
    });

    renderUserBooks();
  });
}

// ===== Render User Books =====
function renderUserBooks(filteredBooks = booksData) {
  const list = $("userBookList");
  if (!list) return;
  list.innerHTML = "";

  if (filteredBooks.length === 0) {
    list.innerHTML = "<p style='color:white;text-align:center;'>No books found.</p>";
    return;
  }

  filteredBooks.forEach((b) => {
    const div = document.createElement("div");
    div.className = "book";

    // check if this book is in the user's borrowed list
    const borrowData = activeBorrows.find((br) => br.bookTitle === b.title);
    let borrowInfo = "";

    if (borrowData) {
      const borrowedDate = new Date(borrowData.timestamp);
      const daysPassed = Math.floor((new Date() - borrowedDate) / (1000 * 60 * 60 * 24));
      const daysLeft = Math.max(borrowData.borrowDays - daysPassed, 0);
      borrowInfo = `
        <div class="borrow-info-box">
          <p class="borrow-info"><strong>Borrowed:</strong> ${daysPassed} day${daysPassed !== 1 ? "s" : ""} ago</p>
          <p class="borrow-info"><strong>Time left:</strong> ${daysLeft} day${daysLeft !== 1 ? "s" : ""}</p>
          <p class="borrow-info"><strong>Due:</strong> ${borrowData.dueDate.toDateString()}</p>
        </div>
      `;
    }

    div.innerHTML = `
      <img src="${b.image || "https://via.placeholder.com/300x420?text=Book"}" class="book-img">
      <h4>${b.title}</h4>
      <p>${b.author}</p>
      <p class="book-category">${b.category}</p>
      ${borrowInfo}
    `;
    div.onclick = () => openModal(b);
    list.appendChild(div);
  });
}

// ===== Add Book Form =====
window.addEventListener("DOMContentLoaded", () => {
  const form = $("addBookForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("bookTitle").value.trim();
    const author = $("bookAuthor").value.trim();
    const category = $("bookCategory").value.trim();
    const imageUrl =
      $("bookImageUrl").value.trim() || "https://via.placeholder.com/300x420?text=Book";

    if (!title || !author || !category) return alert("⚠️ All fields are required!");

    try {
      await addDoc(collection(db, "books"), {
        title,
        author,
        category,
        image: imageUrl,
        timestamp: new Date().toISOString(),
      });
      alert("✅ Book added successfully!");
      form.reset();
      closeAddBookForm();
    } catch (err) {
      console.error("❌ Error adding book:", err);
      alert("Failed to add book. Check console for details.");
    }
  });
});

// ===== Modal =====
function openModal(b) {
  $("modalBookImg").src = b.image;
  $("modalBookTitle").textContent = b.title;
  $("modalBookAuthor").textContent = "Author: " + b.author;
  $("modalBookCategory").textContent = "Category: " + b.category;
  $("borrowBtn").dataset.title = b.title;
  $("bookModal").style.display = "flex";
}
function closeModal() {
  $("bookModal").style.display = "none";
}

// ===== Borrow Book (limit 5) =====
// ===== Borrow Book =====
async function borrowBook() {

  const userName = $("borrowUserName").value.trim();
  const phone = $("borrowPhone").value.trim();

  if (!userName || !phone) {
    alert("⚠️ Please enter your name and phone number.");
    return;
  }

  if (activeBorrows.length >= 5) {
    alert(
      "⚠️ You have reached the limit of 5 borrowed books."
    );
    closeModal();
    return;
  }

  const title = $("borrowBtn").dataset.title;

  const book = booksData.find(
    (b) => b.title === title
  );

  if (!book) return;

  // Check duplicate borrow
  const alreadyBorrowed = activeBorrows.some(
    (b) =>
      b.bookTitle === title &&
      b.userPhone === phone
  );

  if (alreadyBorrowed) {
    alert(`⚠️ You already borrowed "${title}"`);
    closeModal();
    return;
  }

  const request = {
    bookTitle: book.title,
    bookAuthor: book.author,
    bookCategory: book.category,
    bookImage: book.image,

    userName: userName,
    userPhone: phone,

    status: "pending",
    borrowDays: null,
    timestamp: new Date().toISOString(),
  };

  try {
    await addDoc(
      collection(db, "borrowRequests"),
      request
    );

    alert("📚 Borrow request sent!");

    $("borrowUserName").value = "";
    $("borrowPhone").value = "";

    closeModal();

  } catch (err) {
    console.error(err);
    alert("Failed to send request.");
  }
}
// ===== Borrow Requests (Admin) =====
function loadBorrowRequests() {
  const list = $("requestList");
  if (!list) return;
  list.innerHTML = "<p style='color:white;text-align:center;'>Loading...</p>";

  const q = query(collection(db, "borrowRequests"), orderBy("timestamp", "desc"));
  onSnapshot(q, (snap) => {
    list.innerHTML = "";
    if (snap.empty) {
      list.innerHTML = "<p style='color:white;text-align:center;'>No pending requests.</p>";
      $("requestCount").textContent = "0";
      return;
    }

    $("requestCount").textContent = snap.size;

    snap.forEach((docSnap) => {
      const r = docSnap.data();
      const id = docSnap.id;
      const div = document.createElement("div");
      div.className = "borrow-card";
      div.innerHTML = `
        <img src="${r.bookImage}" class="borrow-img">
        <div class="borrow-info">
          <h3>${r.bookTitle}</h3>
          <p><strong>User:</strong> ${r.userName}</p>

<p><strong>Phone:</strong> ${r.userPhone}</p>
          <p><strong>Status:</strong>
            <span class="status-badge status-${r.status}">
              ${r.status.charAt(0).toUpperCase() + r.status.slice(1)}
            </span>
          </p>
          ${
            r.status === "pending"
              ? `<div class="borrow-actions">
                  <input type="number" id="days-${id}" min="1" max="30" placeholder="Days" class="days-input"/>
                  <button class="approve-btn">Approve</button>
                  <button class="deny-btn">Deny</button>
                </div>`
              : ""
          }
        </div>
      `;

      const approve = div.querySelector(".approve-btn");
      const deny = div.querySelector(".deny-btn");

      if (approve) {
        approve.onclick = async () => {
          const daysInput = $(`days-${id}`);
          const days = parseInt(daysInput?.value || "0");
          if (!days || days <= 0) return alert("Enter valid days.");

          const approvedData = { ...r, status: "approved", borrowDays: days };
          await addDoc(collection(db, "borrowedBooks"), approvedData);
          await deleteDoc(doc(db, "borrowRequests", id));
          alert(`✅ Approved for ${days} days`);
        };
      }

      if (deny) {
        deny.onclick = async () => {
          const deniedData = { ...r, status: "denied" };
          await addDoc(collection(db, "borrowedBooks"), deniedData);
          await deleteDoc(doc(db, "borrowRequests", id));
          alert("❌ Request denied");
        };
      }

      list.appendChild(div);
    });
  });
}

// ===== Filters =====
function populateCategoryFilter() {
  const categoryFilter = $("filterCategory");
  if (!categoryFilter) return;
  const categories = new Set(["all"]);
  booksData.forEach((b) => {
    if (b.category && b.category.trim() !== "") categories.add(b.category.trim());
  });
  categoryFilter.innerHTML = "";
  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat.toLowerCase();
    option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    categoryFilter.appendChild(option);
  });
}

function filterByCategory() {
  const selected = $("filterCategory").value.toLowerCase();
  if (selected === "all") return renderUserBooks(booksData);
  const filtered = booksData.filter(
    (b) => b.category && b.category.toLowerCase() === selected
  );
  renderUserBooks(filtered);
}

function searchBooks() {
  const q = $("searchInput").value.toLowerCase();
  const category = $("filterCategory").value.toLowerCase();
  let filtered = booksData.filter(
    (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
  );
  if (category !== "all") {
    filtered = filtered.filter((b) => b.category && b.category.toLowerCase() === category);
  }
  renderUserBooks(filtered);
}

// ===== Navigation =====
function showLogin() {
  hideAll();
  $("login").style.display = "block";
}
function goHome() {
  hideAll();
  $("home").style.display = "block";
}
function showUser() {
  hideAll();
  $("userPage").style.display = "block";
  renderUserBooks();
  checkUserBorrowedStatus();
}
function openBookList() {
  hideAll();
  $("adminBooks").style.display = "block";
  renderAdminBooks();
}
function openBorrowRequests() {
  hideAll();
  $("borrowRequests").style.display = "block";
  loadBorrowRequests();
}
function backToDashboard() {
  hideAll();
  $("dashboard").style.display = "block";
}

// ===== Intro Video =====
window.addEventListener("load", () => {
  const video = $("introVideo");
  const intro = $("intro");
  if (video) {
    video.addEventListener("ended", () => {
      intro.style.display = "none";
      $("home").style.display = "block";
    });
  }
});
window.showLogin = showLogin;
window.showUser = showUser;
window.goHome = goHome;
window.login = () => {
  const e = $("email").value.trim(),
    p = $("password").value.trim();
  if (e === "admin@me.com" && p === "admin123") {
    hideAll();
    $("dashboard").style.display = "block";
  } else showAlert("Invalid credentials!");
};
window.logout = () => {
  hideAll();
  $("home").style.display = "block";
  showAlert("Logged out");
};
window.openBookList = openBookList;
window.openBorrowRequests = openBorrowRequests;
window.backToDashboard = backToDashboard;
window.borrowBook = borrowBook;
window.openModal = openModal;
window.closeModal = closeModal;
window.showAddBookForm = () => ($("addBookModal").style.display = "flex");
window.closeAddBookForm = () => ($("addBookModal").style.display = "none");
window.searchBooks = searchBooks;
window.filterByCategory = filterByCategory;
// Run autoAddBooks() once after Firebase is ready
window.addEventListener("load", () => {
  // uncomment temporarily to run once
  autoAddBooks();
});
// ===== Save Book Review =====
async function saveReview() {
  const title = $("modalBookTitle").textContent;
  const rating = $("ratingValue").value;
  const review = $("reviewText").value.trim();

  if (!rating || !review) return alert("⚠️ Please select a rating and write a review!");

  await addDoc(collection(db, "reviews"), {
    title,
    rating,
    review,
    user: currentUser,
    time: new Date().toISOString(),
  });

  alert("✅ Review added successfully!");
  $("reviewText").value = "";
  $("ratingValue").value = "";
}
window.saveReview = saveReview;
async function toggleFavorite() {
  const title = $("modalBookTitle").textContent;
  const isFav = localStorage.getItem(`fav-${title}`);

  if (isFav) {
    localStorage.removeItem(`fav-${title}`);
    alert(`💔 Removed "${title}" from favorites.`);
  } else {
    localStorage.setItem(`fav-${title}`, "true");
    alert(`❤️ Added "${title}" to favorites.`);
  }
}
window.toggleFavorite = toggleFavorite;
// ================= BORROWED BOOKS MANAGEMENT =================

import {
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// Open Borrowed Books Page
function openBorrowedBooks() {
  hideAll();
  $("borrowedBooksPage").style.display = "block";
  loadBorrowedBooks();
}

// Load Borrowed Books
function loadBorrowedBooks() {
  const list = $("borrowedBooksList");

  if (!list) return;

  list.innerHTML = `
    <p style="text-align:center;color:white;">
      Loading borrowed books...
    </p>
  `;

  const q = query(
    collection(db, "borrowedBooks"),
    orderBy("timestamp", "desc")
  );

  onSnapshot(q, (snap) => {
    list.innerHTML = "";

    if (snap.empty) {
      list.innerHTML = `
        <p style="text-align:center;color:white;">
          No borrowed books found.
        </p>
      `;
      return;
    }

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      borrowedBooksData.push({
  id: docSnap.id,
  ...data
});
      const id = docSnap.id;

      // Skip denied books
      if (data.status === "denied") return;

      const borrowDate = new Date(data.timestamp);
      const dueDate = new Date(borrowDate);

      dueDate.setDate(
        dueDate.getDate() + (data.borrowDays || 0)
      );

      const today = new Date();

      let fine = 0;

      if (today > dueDate) {
        const lateDays = Math.floor(
          (today - dueDate) / (1000 * 60 * 60 * 24)
        );

        fine = lateDays * 10; // ₹10 per late day
      }

      const returned = data.returned || false;

      const div = document.createElement("div");

      div.className = "borrow-card";

      div.innerHTML = `
        <img src="${data.bookImage}" class="borrow-img">

        <div class="borrow-info">
          <h3>${data.bookTitle}</h3>

          <p><strong>User:</strong> ${data.userName}</p>

<p><strong>Phone:</strong> ${data.userPhone}</p>

          <p><strong>Borrow Days:</strong> ${data.borrowDays || 0}</p>

          <p><strong>Due Date:</strong> ${dueDate.toDateString()}</p>

          <p>
            <strong>Fine:</strong>
            ₹${fine}
          </p>

          <p>
            <strong>Status:</strong>

            ${
              returned
                ? `<span class="status-badge status-approved">Returned</span>`
                : `<span class="status-badge status-pending">Borrowed</span>`
            }
          </p>

          ${
            !returned
              ? `
            <div class="borrow-actions">
              <button class="approve-btn return-btn">
                ✅ Mark Returned
              </button>
            </div>
          `
              : ""
          }
        </div>
      `;

      // Return button
      const returnBtn = div.querySelector(".return-btn");

      if (returnBtn) {
        returnBtn.onclick = async () => {
          try {
            await updateDoc(
              doc(db, "borrowedBooks", id),
              {
                returned: true,
                fineAmount: fine,
                returnedAt: new Date().toISOString(),
              }
            );

            alert(
              `Book marked returned.\nFine: ₹${fine}`
            );
          } catch (err) {
            console.error(err);
            alert("Failed to update return.");
          }
        };
      }

      list.appendChild(div);
    });
  });
}
// ===== SEARCH BORROWED BOOKS =====

function searchBorrowedBooks() {

  const value =
    $("borrowedSearch")
      .value
      .toLowerCase();

  const cards =
    document.querySelectorAll(
      "#borrowedBooksList .borrow-card"
    );

  cards.forEach((card) => {

    const text =
      card.textContent.toLowerCase();

    if (text.includes(value)) {

      card.style.display = "flex";

    } else {

      card.style.display = "none";
    }
  });
}

window.searchBorrowedBooks =
  searchBorrowedBooks;

// Make global
window.openBorrowedBooks = openBorrowedBooks;
