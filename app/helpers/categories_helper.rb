module CategoriesHelper
  def show_table(root, first, last)
    if root.is_childless?
      return '<li><span><i class="fa fa-square" aria-hidden="true"></i> ' <<
          show_list_item(root, first, last) <<
          '</li>'+"\n"
    end

    categories = (root.children.to_a).sort_by!{ |cat| cat.list_order }
    category_strings = []
    categories.each_index{ |i|
      category_strings.push show_table(categories[i], i == 0, i + 1 == categories.length)
    }

    ## Note: the span element of class "toggler" below is closed inside the function show_list_item(), in the beginning
    ## part of the variable 'name_part'. Yes, it's ugly as sin, but the only way I could make the category names clickable
    ## (I felt a much needed UX improvement) without completely rewriting the code. Same thing is going on in the if block
    ## at the top of this function. If you rewrite the code, make sure to fix this :=P -dji
    '<li><span class="toggler" style="cursor:pointer;cursor:hand;"><i class="fa fa-plus-square" aria-hidden="true"></i> ' <<
    show_list_item(root, first, last) << "\n"+'<ul class="collapsible" style="display:none;list-style:none;">' <<
    category_strings.join("\n") <<
    '</ul></li>'+"\n"
  end

  def category_path_breadcrumbs(category, extra_sep = false)
    path = category.get_path_from_root
    path.push '' if extra_sep
    path.join(' > ').html_safe
  end

private
  def show_list_item(leaf, first, last)
    if leaf.data_list
      data_list_section = link_to(leaf.data_list.name, "data_lists/super_table/#{leaf.data_list_id}")
    else
      data_list_section = 'No Data List'
    end

    name_part = "<strong>#{leaf.name}</strong></span> (#{data_list_section})"
    name_part += " [#{leaf.default_geo_handle}.#{leaf.default_freq}]" unless leaf.default_geo_id.blank? && leaf.default_freq.blank?
    menu = []
    if current_user.admin_user?
      menu.push order_section(leaf, first, last)
      menu.push link_to('Add_child', {controller: :categories, action: :add_child, id: leaf})
      menu.push link_to('Edit', edit_category_path(leaf))
    end
    if current_user.dev_user?
      if leaf.hidden
        menu.push link_to('Unhide', {:controller => :categories, action: :toggle_hidden, :id => leaf}, remote: true, data: {toggle: 1})
      else
        menu.push link_to('Hide', {:controller => :categories, action: :toggle_hidden, :id => leaf}, remote: true, data: {toggle: 1})
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
