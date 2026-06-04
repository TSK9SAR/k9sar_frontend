// // src/pages/MatrixPage.tsx
// import React from "react";
// import MatrixTable from "../components/MatrixTable";
// import PageContainer from "../components/PageContainer.tsx";

// const MatrixPage: React.FC = () => {
//   const apiBaseUrl = (import.meta as any).env.VITE_API_BASE_URL;

//   return (
//     <PageContainer maxWidth="full">
//     {/* <div className="min-h-screen bg-gray-100 px-4 sm:px-6 lg:px-8 py-6"> */}
//       <div className="mx-auto w-full">
//         <h1 className="text-xl text-left font-semibold mb-4">Certification Matrix</h1>
//         <MatrixTable
//           apiBaseUrl={apiBaseUrl}
//           authToken={localStorage.getItem("token") ?? undefined}
//         />
//       </div>
//     {/* </div> */}
//     </PageContainer>
//   );
// }

// export default MatrixPage;

// MatrixPage.tsx
import PageContainer from "../components/PageContainer";
import MatrixTable from "../components/MatrixTable";

const MatrixPage: React.FC = () => {
  const apiBaseUrl = (import.meta as any).env.VITE_API_BASE_URL;

  return (
    <PageContainer maxWidth="full">
      <div className="w-full">
        <h1 className="text-xl text-left font-semibold mb-4">
          Certification Matrix
        </h1>

        <MatrixTable
          apiBaseUrl={apiBaseUrl}
          authToken={localStorage.getItem("token") ?? undefined}
        />
      </div>
    </PageContainer>
  );
};

export default MatrixPage;
