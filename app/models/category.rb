class Category < ActiveRecord::Base
  has_ancestry

  belongs_to :data_list

  def name_with_depth
    "#{name} (#{depth})"
  end
end
