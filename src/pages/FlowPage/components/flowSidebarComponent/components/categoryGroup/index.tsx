import { SidebarGroup, SidebarGroupContent, SidebarMenu } from "@/components/ui/sidebar";
import { JSX, memo } from "react";
import { CategoryDisclosure } from "../categoryDisclouse";


export const CategoryGroup = memo(function CategoryGroup({
  item,
  openCategories,
  setOpenCategories,
}: any): JSX.Element {
  
  return (
    <>
      <SidebarGroup className="p-1">
        <SidebarGroupContent>
          <SidebarMenu>
          <CategoryDisclosure 
            item={item}
            openCategories={openCategories}
            setOpenCategories={setOpenCategories}
          />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
})