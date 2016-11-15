module CategoriesHelper
  def show_table(root, first, last)
    if root.is_childless?
      return "<li>#{show_list_item(root, first, last)}</li>"
    end

    categories = (root.children.to_a).sort_by!{|cat| cat.order}
    category_strings = []
    categories.each_index{|i| category_strings.push(show_table(categories[i], i == 0, i + 1 == categories.length))}

    '<li>' << show_list_item(root, first, last) << '<ul>' <<
    category_strings.join('') <<
    '</ul></li>'
  end

  def show_list_item(leaf, first, last)
    data_list_section = link_to('Add DataList', edit_category_path(leaf))
    unless leaf.data_list.nil?
      data_list_section = link_to(leaf.data_list.name, "data_lists/super_table/#{leaf.data_list_id}")
    end

    "<strong>#{leaf.name}</strong> (" <<
    data_list_section <<
    ') ' <<
    "[#{leaf.default_handle}.#{leaf.default_freq}] " <<
    order_section(leaf, first, last) << ' - ' <<
    link_to('Edit', edit_category_path(leaf)) << ' - ' <<
    link_to('Destroy', leaf, method: :delete, data: { confirm: 'Are you sure?' })
  end

  private
    def order_section(leaf, first, last)
      if first && last
        return ''
      end
      if first
        return link_to('Down', "/categories/down/#{leaf.id}")
      end
      if last
        return link_to('Up', "/categories/up/#{leaf.id}")
      end

      link_to('Up', "/categories/up/#{leaf.id}") << ' - ' <<
      link_to('Down', "/categories/down/#{leaf.id}")
    end
end
