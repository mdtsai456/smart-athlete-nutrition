# ERD閱讀方式

完整图有18表，不省略教練／營養師。藍色是組織與身分，綠色是營養與餐點。圖中箭頭由子表指向參照表；0..*、0..1、1為允許的關聯數量。箭頭不代表讀写授權。

overview只顯示PK／FK，適合查看關聯；完整圖顯示169個欄位。SVG及PDF可放大閱讀，PNG供預覽。Mermaid版本在full_erd.md，可以複製使用。

SQL是正式來源。tools/build_erd.py從DDL產生DBML與DOT，再以Graphviz轉SVG／PNG／PDF；tools/build_docs.py產生完整Mermaid及欄位字典。SQL CHECK、triggers、交易與身份驗證無法只靠關聯圖表達，請搭配production_guide.md。
