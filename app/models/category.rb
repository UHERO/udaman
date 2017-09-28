class Category < ActiveRecord::Base
  has_ancestry
  belongs_to :data_list
  belongs_to :default_geo_id, class_name: 'Geography'  ## in other words this model's `default_geo_id` is a Geography.id
  before_save :set_list_order

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
    "#{name} (#{depth})"
  end

  def Category.get_or_new_nta(attrs, add_attrs = {})
    attrs.merge!(universe: 'NTA')
    Category.find_by(attrs) || Category.create(attrs.merge(add_attrs))
  end

end
