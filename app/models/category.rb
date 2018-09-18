class Category < ActiveRecord::Base
  include Cleaning
  has_ancestry
  belongs_to :data_list
  belongs_to :default_geo, class_name: 'Geography'  ## in other words this model's `default_geo_id` is a Geography.id
  before_save :set_list_order

  def toggle_tree_masked
    descendants.each{|c| c.update_attributes masked: true }
  end

  def toggle_tree_unmasked
    children.each do |c|
      c.update_attributes masked: false
      c.toggle_tree_unmasked unless c.hidden
    end
  end

  def hide
    self.update_attributes hidden: true
    toggle_tree_masked
  end

  def unhide
    self.update_attributes hidden: false
    toggle_tree_unmasked unless self.masked
  end

  def add_child(params = {})
    max_sib = children.maximum(:list_order)
    defaults = {
        universe: universe,
        name: '*** NEW UNNAMED CATEGORY ***',
        masked: masked || hidden,
        list_order: max_sib.nil? ? 0 : max_sib + 1
    }
    children.create(defaults.merge(params))
  end

  def get_or_add_child(attrs)
    kids = children.where(attrs)
    kids.empty? ? add_child(attrs) : kids.first
  end

  def set_list_order
    return if self.list_order
    self.list_order = 0
    # Even if parent_id is nil this does the right thing.
    last_sib = Category.where(ancestry: parent_id).order('list_order desc').first
    if last_sib && last_sib.list_order
      self.list_order = last_sib.list_order + 1
    end
  end

  def name_with_depth
    if self.data_list
      '%s (%d) - %s' % [name, depth, self.data_list.name]
    else
      '%s (%d)' % [name, depth]
    end
  end

  def Category.get_all(except = nil)
    if except
      Category.where("universe = 'UHERO' AND id != ?", except).order(:name)
    else
      Category.where(universe: 'UHERO').order(:name)
    end
  end

  def default_geo_handle
    Geography.find(default_geo_id).handle rescue ''
  end

end
