class GeoTree < ActiveRecord::Base
  belongs_to :parent, class_name: 'Geography'  ## in other words this model's `parent_id` is a Geography.id
  belongs_to :child, class_name: 'Geography'   ## and likewise here
end
