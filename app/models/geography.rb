class Geography < ActiveRecord::Base

  def Geography.get_or_new_nta(attrs, add_attrs = {})
    attrs.merge!(universe: 'NTA')
    Geography.find_by(attrs) || Geography.create(attrs.merge(add_attrs))
  end
end
