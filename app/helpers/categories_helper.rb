module CategoriesHelper
  def show_table(root, first, last)
    display_class =
        case
          when root.hidden then 'hidden_cat'
          when root.masked > 0 then 'masked_cat'
          else nil
        end
    list_item = show_list_item(root, first, last)
    return "<li class='#{display_class}'>#{list_item}</li>\n" if root.is_childless?

    categories = (root.children.to_a).sort_by!{ |cat| cat.list_order }
    category_strings = []
    categories.each_index{ |i|
      category_strings.push show_table(categories[i], i == 0, i + 1 == categories.length)
    }

    <<~HTML
    <li><span class="#{display_class}">#{list_item}</span>
        <ul class="collapsible" style="display:none;list-style:none;">
          #{category_strings.join("\n")}
        </ul>
    </li>
    HTML
  end

  def category_path_breadcrumbs(category, extra_sep = false)
    path = category.get_path_from_root
    path.push '' if extra_sep
    path.join(' > ').html_safe
  end

private
  def show_list_item(leaf, first, last)
    span_class = leaf.is_childless? ? 'category_leaf' : 'category_non_leaf'
    icon_type = leaf.is_childless? ? 'fa-square' : 'fa-plus-square'
    data_list_section =
        case
          when leaf.data_list then link_to(leaf.data_list.name, "data_lists/super_table/#{leaf.data_list_id}")
          when leaf.header then 'Header'
          else 'No Data List'
        end
    name_part = '<span class="%s"><i class="fa %s" aria-hidden="true"></i> %s</span> (%s)' % [span_class, icon_type, leaf.name, data_list_section]
    unless leaf.default_geo_id.blank? && leaf.default_freq.blank?
      name_part += ' [%s.%s]' % [leaf.default_geo_handle, leaf.default_freq]
    end
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
    menu.push "<span class='hidden_cat' style='#{display}'>***** HIDDEN *****</span>"
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
