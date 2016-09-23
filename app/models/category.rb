class Category < ActiveRecord::Base
  has_ancestry

  belongs_to :data_list
end
