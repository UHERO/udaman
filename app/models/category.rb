class Category < ActiveRecord::Base
  has_ancestry
  belongs_to :data_list
  belongs_to :default_geo, class_name: 'Geography'  ## in other words this model's `default_geo_id` is a Geography.id
  before_save :set_list_order

  def add_child
    child_ancestry = "#{ancestry}/#{id}"
    max_sib = Category.where(ancestry: child_ancestry).maximum(:list_order)
    Category.create(universe: universe,
                    name: 'New child',
                    ancestry: child_ancestry,
                    hidden: hidden,
                    list_order: max_sib.nil? ? 0 : max_sib + 1)
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

  def Category.get_or_new_nta(attrs, add_attrs = {})
    attrs.merge!(universe: 'NTA')
    Category.find_by(attrs) || Category.create(attrs.merge(add_attrs))
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
