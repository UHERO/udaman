module CategoriesHelper
  def show_table(root, first, last)
    if root.is_childless?
      return '<li><span><i class="fa fa-square" aria-hidden="true"></i></span> ' <<
          show_list_item(root, first, last) <<
          '</li>'+"\n"
    end

    categories = (root.children.to_a).sort_by!{ |cat| cat.list_order }
    category_strings = []
    categories.each_index{ |i|
      category_strings.push show_table(categories[i], i == 0, i + 1 == categories.length)
    }

    '<li><span class="toggler" style="cursor:pointer;cursor:hand;"><i class="fa fa-plus-square" aria-hidden="true"></i></span> ' <<
    show_list_item(root, first, last) << "\n"+'<ul class="collapsible" style="display:none;list-style:none;">' <<
    category_strings.join("\n") <<
    '</ul></li>'+"\n"
  end

private
  def show_list_item(leaf, first, last)
    if leaf.data_list
      data_list_section = link_to(leaf.data_list.name, "data_lists/super_table/#{leaf.data_list_id}")
    else
      data_list_section = 'No Data List'
    end

    name_part = "<strong>#{leaf.name}</strong> (#{data_list_section})"
    name_part += " [#{leaf.default_handle}.#{leaf.default_freq}]" unless leaf.default_handle.blank? && leaf.default_freq.blank?
    menu = []
    if current_user.admin_user?
      menu.push order_section(leaf, first, last)
      menu.push link_to('Edit', edit_category_path(leaf))
    end
    if current_user.dev_user?
      if leaf.hidden
        menu.push link_to('Unhide', {:controller => :categories, action: :unhide, :id => leaf}, remote: true, data: {unhide: 1})
      else
        menu.push link_to('Hide', {:controller => :categories, action: :hide, :id => leaf}, remote: true, data: {hide: 1})
      end
      menu.push link_to('Destroy', leaf, method: :delete, data: { confirm: "Destroy #{leaf.name}: Are you sure??" })
    end
    display = leaf.hidden ? '' : 'display:none;'
    menu.push "<span class='hidden_cat_label' style='#{display}'>***** HIDDEN *****</span>"
    name_part + ' ' + menu.join(' - ')
  end

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
