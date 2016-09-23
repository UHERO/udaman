module CategoriesHelper
  def show_table(root)
    if root.is_childless?
      return "<li>#{show_list_item root}</li>"
    end
    '<li>' << show_list_item(root) << '<ul>' <<
    root.children.map{|node| show_table(node)}.join('') <<
    '</ul></li>'
  end

  def show_list_item(leaf)
    data_list_section = link_to('Add DataList', edit_category_path(leaf))
    unless leaf.data_list.nil?
      data_list_section = link_to(leaf.data_list.name, "data_lists/super_table/#{leaf.data_list_id}")
    end
    "#{leaf.name} (" <<
    data_list_section <<
    ') ' << link_to('Edit', edit_category_path(leaf)) << ' - ' <<
    link_to('Destroy', leaf, method: :delete, data: { confirm: 'Are you sure?' })
  end
end
