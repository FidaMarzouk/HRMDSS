import Swal from "sweetalert2";

// Dark-themed SweetAlert helpers shared by every page.
const darkTheme = {
  popup: "bg-[#1E1E1E] text-white border border-gray-700",
  title: "text-white",
  htmlContainer: "text-gray-300",
  confirmButton: "bg-[#3baca5] hover:bg-[#2a7d78] text-white",
  cancelButton: "bg-[#333] hover:bg-[#444] text-gray-200",
};

export const showSuccess = (title, text) =>
  Swal.fire({ icon: "success", title, text, timer: 2000, showConfirmButton: false, customClass: darkTheme });

export const showError = (title, text) =>
  Swal.fire({ icon: "error", title, text, customClass: darkTheme });

export const showWarning = (title, text) =>
  Swal.fire({ icon: "warning", title, text, customClass: darkTheme });

export const confirmAction = async (title, text, confirmButtonText = "Confirm") => {
  const result = await Swal.fire({
    icon: "warning",
    title,
    text,
    showCancelButton: true,
    confirmButtonText,
    customClass: darkTheme,
  });
  return result.isConfirmed;
};
