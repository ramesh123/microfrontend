// import React from 'react';
// import { SetCustomColumn } from './components/customColumn';

interface SetCustomColumnProps {
  onClickSave: (filterType: string) => void;
}

function SetCustomColumn({ onClickSave }: SetCustomColumnProps) {

  const handleSaveCustomColumn = (filterType: string) => {
    onClickSave(filterType);
  };

  return (
    <div className="">
      <SetCustomColumn onClickSave={handleSaveCustomColumn} />
    </div>
  );
}

// interface SetCustomColumnProps {
//   onClickSave: (filterType: string, data: any) => void;
// }

// function SetCustomColumn({ onClickSave }: SetCustomColumnProps) {

//   const handleSaveCustomColumn = (filterType: string, data: any) => {
//     onClickSave(filterType, data);
//   };
//   return (
//     <div className="">
//       <SetCustomColumn onClickSave={handleSaveCustomColumn} />
//     </div>
//   );
// }

// export default SetCustomColumn;
