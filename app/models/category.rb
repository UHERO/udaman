class Category < ActiveRecord::Base
  has_ancestry

  belongs_to :data_list

  def store_cat
    self.order = 0
    # Even if parent_id is nil this does the right thing.
    last_child = Category.where(ancestry: parent_id).order('categories.order desc').limit(1)[0]
    if last_child && last_child.order
      self.order = last_child.order + 1
    end
    save
  end

  def name_with_depth
    "#{name} (#{depth})"
  end
end
